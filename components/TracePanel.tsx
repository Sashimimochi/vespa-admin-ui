'use client'
import { useState } from 'react'

interface TracePanelProps { vespaUrl: string; configUrl: string }

interface TraceNode {
  message?: string
  timestamp?: number
  children?: TraceNode[]
  [key: string]: unknown
}

function extractTraceMessages(trace: unknown, depth = 0): Array<{ level: number; message: string; timestamp?: number; type: string }> {
  const results: Array<{ level: number; message: string; timestamp?: number; type: string }> = []

  if (!trace || typeof trace !== 'object') return results

  const t = trace as TraceNode
  if (t.message !== undefined && t.message !== null) {
    // message はオブジェクト・数値など何でもあり得るので必ず文字列に変換する
    const msg = typeof t.message === 'string'
      ? t.message
      : JSON.stringify(t.message)
    const lower = msg.toLowerCase()
    let type = 'info'
    if (lower.includes('token') || lower.includes('stem') || lower.includes('linguist')) type = 'linguistic'
    else if (lower.includes('error') || lower.includes('fail')) type = 'error'
    else if (lower.includes('rewrite') || lower.includes('query')) type = 'query'
    else if (lower.includes('rank') || lower.includes('score')) type = 'rank'
    results.push({ level: depth, message: msg, timestamp: t.timestamp, type })
  }

  // children / trace キーを再帰処理
  for (const key of ['children', 'trace', 'log']) {
    const val = (trace as Record<string, unknown>)[key]
    if (Array.isArray(val)) {
      for (const child of val) {
        results.push(...extractTraceMessages(child, depth + 1))
      }
    }
  }

  return results
}

const TYPE_COLORS: Record<string, string> = {
  linguistic: '#00b4d8',
  query: '#818cf8',
  rank: '#f59e0b',
  error: '#ef4444',
  info: '#64748b',
}

export default function TracePanel({ vespaUrl, configUrl }: TracePanelProps) {
  const [yql, setYql] = useState("select * from sources * where userQuery()")
  const [query, setQuery] = useState('vespa')
  const [traceLevel, setTraceLevel] = useState('4')
  const [language, setLanguage] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<ReturnType<typeof extractTraceMessages>>([])
  const [rawTrace, setRawTrace] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showRaw, setShowRaw] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<Array<{field: string; tokens: string[]}>>([])

  const runTrace = async () => {
    setLoading(true)
    setError('')
    setMessages([])
    setTokenInfo([])

    const params: Record<string, string> = {
      yql,
      'trace.level': traceLevel,
      hits: '3',
    }
    if (query) params.query = query
    if (language) params.language = language

    try {
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/search/', method: 'GET', params, vespaUrl, configUrl })
      })
      const json = await res.json()
      const data = json.data

      // Extract trace
      const trace = data?.trace
      setRawTrace(trace)

      if (trace) {
        const msgs = extractTraceMessages(trace)
        setMessages(msgs)

        // Try to extract token info from result summaries
        const children = data?.root?.children || []
        const ti: Array<{field: string; tokens: string[]}> = []
        for (const child of children) {
          const fields = child?.fields || {}
          for (const [k, v] of Object.entries(fields)) {
            if (k.endsWith('_tokens') && Array.isArray(v)) {
              ti.push({ field: k.replace('_tokens', ''), tokens: v as string[] })
            }
          }
        }
        setTokenInfo(ti)
      }

      if (!json.ok) setError(json.error || 'Request failed')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const filtered = filterType === 'all' ? messages : messages.filter(m => m.type === filterType)
  const types = ['all', ...Array.from(new Set(messages.map(m => m.type)))]
  const needsQuery = yql.includes('userQuery()') && !query.trim()

  return (
    <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
        <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>QUERY ANALYZER</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>YQL</label>
            <textarea
              className="code-editor"
              value={yql}
              onChange={e => setYql(e.target.value)}
              rows={2}
            />
          </div>
          {needsQuery && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#2a1a00', border: '1px solid #f59e0b', borderRadius: 4, padding: '8px 12px' }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'monospace', lineHeight: 1.5 }}>
                YQL に <strong>userQuery()</strong> が含まれています。<br />
                下の <strong>query</strong> フィールドに検索テキストを入力しないと Vespa がエラーを返します。
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 8 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: needsQuery ? '#f59e0b' : '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>
                query{needsQuery ? ' ⚠ 必須: userQuery() の展開テキスト' : ' (userQuery() の展開テキスト)'}
              </label>
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                placeholder="例: vespa search"
                style={{ width: '100%', background: 'var(--vespa-bg)', border: `1px solid ${needsQuery ? '#f59e0b' : 'var(--vespa-border)'}`, borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>trace.level (1-9)</label>
              <select value={traceLevel} onChange={e => setTraceLevel(e.target.value)}
                style={{ width: '100%', background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}>
                {[1,2,3,4,5,6,7,8,9].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>language</label>
              <input type="text" value={language} onChange={e => setLanguage(e.target.value)}
                placeholder="ja, en, zh..."
                style={{ width: '100%', background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>
        </div>
        <button onClick={runTrace} disabled={loading || needsQuery}
          style={{ marginTop: 12, background: (loading || needsQuery) ? '#1a2a35' : 'var(--vespa-accent)', color: (loading || needsQuery) ? '#64748b' : '#0c0e11', border: 'none', borderRadius: 6, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: (loading || needsQuery) ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Sans' }}>
          {loading ? '⟳ Analyzing...' : needsQuery ? '⚠ query を入力してください' : '🔬 Analyze Query'}
        </button>
      </div>

      {/* Hint about tokens debug summary */}
      <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 12, fontSize: 11, color: '#64748b', lineHeight: 1.7 }}>
        <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>💡 Tip:</span> To see actual indexed tokens per field, add a debug summary to your schema:
        <code style={{ display: 'block', fontFamily: 'monospace', color: '#a8d8ea', marginTop: 4, whiteSpace: 'pre-wrap' }}>
{`document-summary debug-summary {
  summary myfield { }
  summary myfield_tokens { source: myfield tokens }
}`}
        </code>
        Then pass <code style={{ color: '#a8d8ea', fontFamily: 'monospace' }}>summary=debug-summary</code> in the search params above.
      </div>

      {error && (
        <div style={{ background: '#1a0f0f', border: '1px solid #ef4444', borderRadius: 6, padding: 12, color: '#ef4444', fontFamily: 'monospace', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>❌ エラー</div>
          <div>{error}</div>
          {yql.includes('userQuery()') && !query && (
            <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 11 }}>
              💡 ヒント: userQuery() を使う場合は &quot;query&quot; フィールドに検索テキストを入力してください
            </div>
          )}
        </div>
      )}

      {tokenInfo.length > 0 && (
        <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
          <div style={{ color: '#00b4d8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>INDEXED TOKENS (from debug summary)</div>
          {tokenInfo.map(ti => (
            <div key={ti.field} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#818cf8', fontFamily: 'monospace', marginBottom: 4 }}>{ti.field}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ti.tokens.map((tok, i) => (
                  <span key={i} style={{ background: '#0d1b24', border: '1px solid #00b4d8', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontFamily: 'monospace', color: '#00b4d8' }}>
                    {tok}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>
              TRACE LOG ({messages.length} messages)
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {types.map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  style={{ fontSize: 10, color: filterType === t ? (TYPE_COLORS[t] || '#e2e8f0') : '#64748b', background: 'none', border: '1px solid ' + (filterType === t ? (TYPE_COLORS[t] || '#e2e8f0') : 'var(--vespa-border)'), borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {t}
                </button>
              ))}
              <button onClick={() => setShowRaw(!showRaw)}
                style={{ fontSize: 10, color: '#64748b', background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer', fontFamily: 'monospace' }}>
                {showRaw ? 'parsed' : 'raw JSON'}
              </button>
            </div>
          </div>

          {showRaw ? (
            <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#a8d8ea', overflow: 'auto', maxHeight: 400, margin: 0 }}>
              {JSON.stringify(rawTrace, null, 2)}
            </pre>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 500, overflow: 'auto' }}>
              {filtered.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 8, padding: '4px 0',
                  paddingLeft: m.level * 12,
                  borderLeft: `2px solid ${m.level > 0 ? 'var(--vespa-border)' : 'transparent'}`,
                }}>
                  <span style={{ fontSize: 10, color: '#3a4252', fontFamily: 'monospace', flexShrink: 0, marginTop: 1 }}>{String(i).padStart(3, '0')}</span>
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: TYPE_COLORS[m.type] + '20', color: TYPE_COLORS[m.type], fontFamily: 'monospace', flexShrink: 0, alignSelf: 'flex-start' }}>
                    {m.type}
                  </span>
                  <span style={{ fontSize: 12, color: '#cbd5e1', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.5, wordBreak: 'break-all' }}>
                    {m.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
