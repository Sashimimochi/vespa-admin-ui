'use client'
import { useState, useRef } from 'react'

interface DocumentPanelProps { vespaUrl: string; configUrl: string }

type Operation = 'insert' | 'fullUpdate' | 'partialUpdate' | 'delete'

const OPERATION_LABELS: Record<Operation, string> = {
  insert: '➕ Insert',
  fullUpdate: '✏️ Full Update',
  partialUpdate: '🔧 Partial Update',
  delete: '🗑️ Delete',
}

const OPERATION_METHODS: Record<Operation, string> = {
  insert: 'PUT',
  fullUpdate: 'PUT',
  partialUpdate: 'POST',
  delete: 'DELETE',
}

interface DocResult {
  docId: string
  ok: boolean
  status: number
  data: unknown
}

// Vespa の partial update フォーマット例
const PARTIAL_UPDATE_PLACEHOLDER = `{
  "fields": {
    "fieldName": { "assign": "new value" },
    "numericField": { "increment": 1 }
  }
}`

const FULL_DOC_PLACEHOLDER = `{
  "fields": {
    "title": "Sample Document",
    "body": "Hello Vespa!"
  }
}`

export default function DocumentPanel({ vespaUrl, configUrl }: DocumentPanelProps) {
  const [operation, setOperation] = useState<Operation>('insert')
  const [namespace, setNamespace] = useState('default')
  const [docType, setDocType] = useState('doc')
  const [docId, setDocId] = useState('')
  const [jsonBody, setJsonBody] = useState('')
  const [inputMode, setInputMode] = useState<'manual' | 'batch'>('manual')
  const [batchJson, setBatchJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DocResult[]>([])
  const [parseError, setParseError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const needsBody = operation !== 'delete'

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
            return executeOne(ns, dt, id, body)
          })
        )
        setResults(batchResults)
      }
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                onChange={e => setDocId(e.target.value)}
                placeholder="my-doc-1"
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>

          {needsBody && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>DOCUMENT BODY (JSON)</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    📂 ファイル読み込み
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
                {!r.ok && r.data && (
                  <div style={{ padding: '6px 12px', background: '#0c0e11' }}>
                    <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#ef4444', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2)}
                    </pre>
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
