'use client'
import { useState, useRef, ChangeEvent } from 'react'

interface DocumentPanelProps { vespaUrl: string; configUrl: string }

type Operation = 'insert' | 'fullUpdate' | 'partialUpdate' | 'delete'

const OPERATION_LABELS: Record<Operation, string> = {
  insert: '➕ Insert',
  fullUpdate: '✏️ Full Update',
  partialUpdate: '🔧 Partial Update',
  delete: '🗑️ Delete',
}

const OPERATION_METHODS: Record<Operation, string> = {
  // このVespa環境は document-processing 有効のため PUT/POST の役割が逆転している:
  // POST = フルドキュメント書き込み (insert / full update)
  // PUT  = 部分更新 (partial update: assign/increment 等)
  insert: 'POST',
  fullUpdate: 'POST',
  partialUpdate: 'PUT',
  delete: 'DELETE',
}

interface DocResult {
  docId: string
  ok: boolean
  status: number
  data: unknown
}

// Vespa のフィールド操作フォーマット例
// document-processing が有効な構成では PUT/POST いずれも assign 形式が必要
const PARTIAL_UPDATE_PLACEHOLDER = `{
  "fields": {
    "fieldName": { "assign": "new value" },
    "numericField": { "increment": 1 }
  }
}`

const FULL_DOC_PLACEHOLDER = `{
  "fields": {
    "title": "Sample Document",
    "artist": "Artist Name",
    "year": 2024
  }
}`

/**
 * document-processing が有効な Vespa 環境向けに
 * フィールド値が単純値 (string/number/boolean/null/array) の場合に
 * { "assign": value } 形式へ自動変換する。
 * すでにオブジェクト形式 (assign/increment/decrement 等) の場合はそのまま。
 */
function autoWrapAssign(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('fields' in body)) return body
  const { fields, ...rest } = body as Record<string, unknown>
  if (typeof fields !== 'object' || fields === null) return body
  const wrapped: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(fields as Record<string, unknown>)) {
    if (
      typeof val === 'object' && val !== null && !Array.isArray(val)
    ) {
      // すでにオブジェクト → assign/increment 等の操作オブジェクトとみなしてそのまま
      wrapped[key] = val
    } else {
      // 単純値 (string/number/boolean/null/array) → assign でラップ
      wrapped[key] = { assign: val }
    }
  }
  return { ...rest, fields: wrapped }
}

/**
 * Vespa フルドキュメント ID（`id:<namespace>:<doctype>::<user-id>`）を分解する。
 * 該当しない場合は null を返す。
 */
function parseVespaDocId(input: string): { namespace: string; docType: string; userId: string } | null {
  const m = input.match(/^id:([^:]+):([^:]+)::(.+)$/)
  if (!m) return null
  return { namespace: m[1], docType: m[2], userId: m[3] }
}

/**
 * Vespa エラーレスポンスが「Document API 未設定」かを判定する。
 */
function isDocApiNotConfigured(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false
  const d = data as Record<string, unknown>
  return (
    d['error-code'] === 'NOT_FOUND' &&
    typeof d['message'] === 'string' &&
    d['message'].includes('Document API is not configured')
  )
}

export default function DocumentPanel({ vespaUrl, configUrl }: DocumentPanelProps) {
  const [operation, setOperation] = useState<Operation>('insert')
  const [namespace, setNamespace] = useState('music')
  const [docType, setDocType] = useState('music')
  const [docId, setDocId] = useState('')
  const [jsonBody, setJsonBody] = useState('')
  const [inputMode, setInputMode] = useState<'manual' | 'batch'>('manual')
  const [batchJson, setBatchJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DocResult[]>([])
  const [parseError, setParseError] = useState('')
  const [autoWrap, setAutoWrap] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const needsBody = operation !== 'delete'

  const handleFormatJson = (jsonString: string, setter: (v: string) => void) => {
    try {
      const parsed = JSON.parse(jsonString)
      setter(JSON.stringify(parsed, null, 2))
      setParseError('')
    } catch {
      setParseError('JSON のパースに失敗しました。形式を確認してください。')
    }
  }

  const buildEndpoint = (ns: string, dt: string, id: string) =>
    `/document/v1/${encodeURIComponent(ns)}/${encodeURIComponent(dt)}/docid/${encodeURIComponent(id)}`

  const executeOne = async (ns: string, dt: string, id: string, body: unknown): Promise<DocResult> => {
    const endpoint = buildEndpoint(ns, dt, id)
    const method = OPERATION_METHODS[operation]
    const res = await fetch('/api/vespa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint,
        method,
        requestBody: needsBody ? body : undefined,
        vespaUrl,
        configUrl,
      }),
    })
    const json = await res.json()
    return { docId: id, ok: json.ok, status: json.status, data: json.data }
  }

  const handleExecute = async () => {
    setParseError('')
    setResults([])
    setLoading(true)

    try {
      if (inputMode === 'manual') {
        // 単一ドキュメント
        if (!docId.trim()) {
          setParseError('Document ID を入力してください。')
          setLoading(false)
          return
        }
        let parsedBody: unknown = {}
        if (needsBody) {
          try {
            parsedBody = JSON.parse(jsonBody || '{}')
          } catch {
            setParseError('JSON のパースに失敗しました。形式を確認してください。')
            setLoading(false)
            return
          }
          // partialUpdate (PUT) 向け: 単純値フィールドを assign 形式へ自動変換
          if (autoWrap && operation === 'partialUpdate') {
            parsedBody = autoWrapAssign(parsedBody)
          }
        }
        const result = await executeOne(namespace, docType, docId.trim(), parsedBody)
        setResults([result])
      } else {
        // バッチ
        let docs: Array<{ id: string; namespace?: string; docType?: string; fields?: unknown; body?: unknown }>
        try {
          docs = JSON.parse(batchJson)
          if (!Array.isArray(docs)) throw new Error('配列形式で入力してください。')
        } catch (e: unknown) {
          setParseError(e instanceof Error ? e.message : 'JSONパースエラー')
          setLoading(false)
          return
        }
        const batchResults = await Promise.all(
          docs.map(async (doc) => {
            const ns = doc.namespace || namespace
            const dt = doc.docType || docType
            const id = doc.id
            if (!id) {
              return { docId: '(不明)', ok: false, status: 0, data: 'id フィールドが必要です' } as DocResult
            }
            const body = doc.body || (doc.fields ? { fields: doc.fields } : {})
            const finalBody = (autoWrap && operation === 'partialUpdate')
              ? autoWrapAssign(body)
              : body
            return executeOne(ns, dt, id, finalBody)
          })
        )
        setResults(batchResults)
      }
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (inputMode === 'manual') {
        setJsonBody(text)
      } else {
        setBatchJson(text)
      }
    }
    reader.readAsText(file)
    // ファイル選択をリセット（同じファイルを再選択できるように）
    e.target.value = ''
  }

  const placeholder = operation === 'partialUpdate' ? PARTIAL_UPDATE_PLACEHOLDER : FULL_DOC_PLACEHOLDER

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Feed URL indicator */}
      <div style={{ background: '#0f1923', border: '1px solid #1e3a4a', borderRadius: 5, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 11 }}>Feed URL:</span>
        <span style={{ color: '#38bdf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{vespaUrl}</span>
        <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: 10 }}>— Settings から変更可</span>
      </div>
      {/* Operation Selector */}
      <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14 }}>
        <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>OPERATION</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(OPERATION_LABELS) as Operation[]).map(op => (
            <button
              key={op}
              onClick={() => setOperation(op)}
              style={{
                padding: '7px 16px',
                borderRadius: 5,
                border: `1px solid ${operation === op ? '#00b4d8' : '#252b38'}`,
                background: operation === op ? '#00b4d815' : 'none',
                color: operation === op ? '#00b4d8' : '#64748b',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'IBM Plex Sans',
                fontWeight: operation === op ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {OPERATION_LABELS[op]}
            </button>
          ))}
        </div>
      </div>

      {/* Input Mode */}
      <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14 }}>
        <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>INPUT MODE</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['manual', 'batch'] as const).map(m => (
            <button
              key={m}
              onClick={() => setInputMode(m)}
              style={{
                padding: '5px 14px',
                borderRadius: 5,
                border: `1px solid ${inputMode === m ? '#a78bfa' : '#252b38'}`,
                background: inputMode === m ? '#a78bfa15' : 'none',
                color: inputMode === m ? '#a78bfa' : '#64748b',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'monospace',
              }}
            >
              {m === 'manual' ? '📝 Single' : '📦 Batch'}
            </button>
          ))}
        </div>
      </div>

      {inputMode === 'manual' ? (
        /* Single Document */
        <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }}>DOCUMENT TARGET</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>NAMESPACE</label>
              <input
                type="text"
                value={namespace}
                onChange={e => setNamespace(e.target.value)}
                placeholder="default"
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>DOC TYPE</label>
              <input
                type="text"
                value={docType}
                onChange={e => setDocType(e.target.value)}
                placeholder="doc"
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>DOCUMENT ID</label>
              <input
                type="text"
                value={docId}
                onChange={e => {
                  const val = e.target.value
                  const parsed = parseVespaDocId(val)
                  if (parsed) {
                    // フルVespa ID形式（id:ns:dt::user-id）なら各フィールドを自動補完
                    setNamespace(parsed.namespace)
                    setDocType(parsed.docType)
                    setDocId(parsed.userId)
                  } else {
                    setDocId(val)
                  }
                }}
                placeholder="100  または  id:music:music::100 を貼り付け"
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
              <div style={{ fontSize: 10, color: '#475569', marginTop: 3, fontFamily: 'monospace', lineHeight: 1.5 }}>
                ヒント: <code style={{ color: '#a78bfa' }}>id:&lt;namespace&gt;:&lt;doctype&gt;::&lt;id&gt;</code> 形式を貼り付けると自動分解されます
              </div>
            </div>
          </div>

          {needsBody && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>DOCUMENT BODY (JSON)</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {operation === 'partialUpdate' && (
                    <button
                      onClick={() => setAutoWrap(v => !v)}
                      title="有効にすると単純値フィールドを {&quot;assign&quot;: value} 形式に自動変換します"
                      style={{
                        fontSize: 11, fontFamily: 'monospace', cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
                        border: `1px solid ${autoWrap ? '#818cf8' : '#252b38'}`,
                        background: autoWrap ? '#818cf815' : 'none',
                        color: autoWrap ? '#818cf8' : '#64748b',
                      }}
                    >
                      {autoWrap ? '⚡ auto-assign: ON' : '⚡ auto-assign: OFF'}
                    </button>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    📂 ファイル読み込み
                  </button>
                  <button
                    onClick={() => handleFormatJson(jsonBody, setJsonBody)}
                    style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    ✨ フォーマット
                  </button>
                  <button
                    onClick={() => setJsonBody('')}
                    style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                className="code-editor"
                value={jsonBody}
                onChange={e => setJsonBody(e.target.value)}
                rows={10}
                placeholder={placeholder}
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '8px 10px', color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none', resize: 'vertical' }}
              />
              {autoWrap && operation === 'partialUpdate' && (
                <div style={{ fontSize: 10, color: '#475569', marginTop: 4, fontFamily: 'monospace', lineHeight: 1.6 }}>
                  ⚡ <strong style={{ color: '#818cf8' }}>auto-assign ON</strong>:
                  単純値フィールド（文字列・数値等）は送信時に自動で{' '}
                  <code style={{ color: '#a78bfa' }}>{'{\"assign\": value}'}</code> 形式に変換されます。
                  既にオブジェクト形式（<code style={{ color: '#a78bfa' }}>assign</code> / <code style={{ color: '#a78bfa' }}>increment</code> 等）のフィールドはそのまま送信されます。
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Batch */
        <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }}>BATCH JSON</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
              >
                📂 ファイル読み込み
              </button>
              <button
                onClick={() => handleFormatJson(batchJson, setBatchJson)}
                style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
              >
                ✨ フォーマット
              </button>
              <button
                onClick={() => setBatchJson('')}
                style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
              >
                Clear
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', lineHeight: 1.6 }}>
            デフォルト Namespace: <strong style={{ color: '#94a3b8' }}>{namespace}</strong>　Doc Type: <strong style={{ color: '#94a3b8' }}>{docType}</strong>
            （各要素で <code style={{ color: '#a78bfa' }}>namespace</code> / <code style={{ color: '#a78bfa' }}>docType</code> を指定してオーバーライド可能）
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>DEFAULT NAMESPACE</label>
              <input
                type="text"
                value={namespace}
                onChange={e => setNamespace(e.target.value)}
                placeholder="default"
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>DEFAULT DOC TYPE</label>
              <input
                type="text"
                value={docType}
                onChange={e => setDocType(e.target.value)}
                placeholder="doc"
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
          <textarea
            className="code-editor"
            value={batchJson}
            onChange={e => setBatchJson(e.target.value)}
            rows={14}
            placeholder={`[
  { "id": "doc-1", "fields": { "title": "First document" } },
  { "id": "doc-2", "namespace": "custom", "docType": "article", "fields": { "title": "Second document" } }
]`}
            style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '8px 10px', color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none', resize: 'vertical' }}
          />
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Parse Error */}
      {parseError && (
        <div style={{ background: '#1a0f0f', border: '1px solid #ef4444', borderRadius: 6, padding: 12, color: '#ef4444', fontFamily: 'monospace', fontSize: 12 }}>
          ✗ {parseError}
        </div>
      )}

      {/* Execute Button */}
      <div>
        <button
          onClick={handleExecute}
          disabled={loading}
          style={{
            background: loading ? '#1a2a35' : (operation === 'delete' ? '#7f1d1d' : '#00b4d8'),
            color: loading ? '#64748b' : (operation === 'delete' ? '#fca5a5' : '#0c0e11'),
            border: 'none', borderRadius: 6, padding: '10px 28px',
            fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'IBM Plex Sans', transition: 'background 0.15s',
          }}
        >
          {loading ? '⟳ 処理中...' : `▶ Execute ${OPERATION_LABELS[operation]}`}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div style={{
            background: '#13171e', border: '1px solid #252b38', borderRadius: '6px 6px 0 0',
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 16,
            borderBottom: 'none',
          }}>
            <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em' }}>RESULTS</span>
            <span style={{ fontSize: 12, color: '#4ade80', fontFamily: 'monospace' }}>
              成功: <strong>{results.filter(r => r.ok).length}</strong>
            </span>
            <span style={{ fontSize: 12, color: '#ef4444', fontFamily: 'monospace' }}>
              失敗: <strong>{results.filter(r => !r.ok).length}</strong>
            </span>
            <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
              合計: {results.length}
            </span>
          </div>
          <div style={{ background: '#0c0e11', border: '1px solid #252b38', borderRadius: '0 0 6px 6px', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${r.ok ? '#22c55e40' : '#ef444440'}`,
                  borderRadius: 5,
                  overflow: 'hidden',
                }}
              >
                <div style={{ background: r.ok ? '#22c55e10' : '#ef444410', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: r.ok ? '#22c55e' : '#ef4444', fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>
                    {r.ok ? '✓' : '✗'}
                  </span>
                  <span style={{ color: '#7dd3fc', fontFamily: 'monospace', fontSize: 12, flex: 1 }}>
                    {r.docId}
                  </span>
                  <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>
                    HTTP {r.status}
                  </span>
                </div>
                {r.data && (
                  <div style={{ padding: '6px 12px', background: '#0c0e11' }}>
                    {!r.ok && isDocApiNotConfigured(r.data) ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#ef4444', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {JSON.stringify(r.data, null, 2)}
                        </pre>
                        <div style={{ background: '#1a1f29', border: '1px solid #f59e0b40', borderRadius: 5, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ color: '#f59e0b', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>⚠ 修正方法: Vespa services.xml に Document API を追加してください</div>
                          <div style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
                            Vespa アプリケーションの <code style={{ color: '#7dd3fc' }}>services.xml</code> の{' '}
                            <code style={{ color: '#7dd3fc' }}>&lt;container&gt;</code> ノード内に以下を追加してデプロイしてください：
                          </div>
                          <pre style={{ background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '8px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#4ade80', margin: 0 }}>
{`<document-api/>`}
                          </pre>
                          <div style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10, lineHeight: 1.6 }}>
                            参考: <a href="https://docs.vespa.ai/en/reference/services/container.html#document-api" target="_blank" rel="noreferrer" style={{ color: '#818cf8' }}>https://docs.vespa.ai/en/reference/services/container.html#document-api</a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: r.ok ? '#4ade80' : '#ef4444', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
