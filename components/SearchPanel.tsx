'use client'
import { useState } from 'react'

interface SearchPanelProps { vespaUrl: string; configUrl: string }

const COMMON_PARAMS = [
  { key: 'hits', label: 'hits', default: '10' },
  { key: 'offset', label: 'offset', default: '0' },
  { key: 'ranking', label: 'ranking', default: '' },
  { key: 'summary', label: 'summary', default: '' },
  { key: 'model.language', label: 'language', default: '' },
  { key: 'timeout', label: 'timeout', default: '' },
]

// ---- JsonRenderer ----
function JsonRenderer({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth >= 4)

  if (data === null) return <span style={{ color: '#94a3b8' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: '#4ade80' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: '#fb923c' }}>{data}</span>
  if (typeof data === 'string') {
    return (
      <span style={{ color: '#7dd3fc' }}>
        &quot;{data.length > 300 ? data.slice(0, 300) + '…' : data}&quot;
      </span>
    )
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#475569' }}>[]</span>
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand array' : 'Collapse array'}
          style={{ color: '#64748b', fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', fontSize: 'var(--font-sm)' }}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        {collapsed ? (
          <span style={{ color: '#475569', cursor: 'pointer' }} onClick={() => setCollapsed(false)}>
            [{data.length} items]
          </span>
        ) : (
          <>
            {'['}
            <div style={{ marginLeft: 20 }}>
              {data.map((item, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  <JsonRenderer data={item} depth={depth + 1} />
                  {i < data.length - 1 && <span style={{ color: '#475569' }}>,</span>}
                </div>
              ))}
            </div>
            {']'}
          </>
        )}
      </span>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data as object)
    if (keys.length === 0) return <span style={{ color: '#475569' }}>{'{}'}</span>
    return (
      <span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand object' : 'Collapse object'}
          style={{ color: '#64748b', fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', fontSize: 'var(--font-sm)' }}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        {collapsed ? (
          <span style={{ color: '#475569', cursor: 'pointer' }} onClick={() => setCollapsed(false)}>
            {`{${keys.length} keys}`}
          </span>
        ) : (
          <>
            {'{'}
            <div style={{ marginLeft: 20 }}>
              {keys.map((k, i) => (
                <div key={k} style={{ marginBottom: 2 }}>
                  <span style={{ color: '#a78bfa' }}>&quot;{k}&quot;</span>
                  <span style={{ color: '#475569' }}>: </span>
                  <JsonRenderer data={(data as Record<string, unknown>)[k]} depth={depth + 1} />
                  {i < keys.length - 1 && <span style={{ color: '#475569' }}>,</span>}
                </div>
              ))}
            </div>
            {'}'}
          </>
        )}
      </span>
    )
  }
  return <span>{String(data)}</span>
}

// ---- Hit Card ----
interface HitData {
  id?: string
  relevance?: number
  source?: string
  fields?: Record<string, unknown>
  [key: string]: unknown
}

function HitCard({ hit, index }: { hit: HitData; index: number }) {
  const [open, setOpen] = useState(true)
  const fields = hit.fields || {}
  const fieldEntries = Object.entries(fields)

  return (
    <div style={{
      border: '1px solid #252b38',
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* Hit header */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Collapse document details' : 'Expand document details'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', textAlign: 'left',
          background: '#13171e', border: 'none',
          padding: '8px 12px', cursor: 'pointer',
        }}
      >
        <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 'var(--font-sm)', flexShrink: 0 }}>
          #{index + 1}
        </span>
        <span style={{ color: '#7dd3fc', fontFamily: 'monospace', fontSize: 'var(--font-base)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(hit.id || '—')}
        </span>
        <span style={{ fontSize: 'var(--font-sm)', color: '#fb923c', fontFamily: 'monospace', flexShrink: 0 }}>
          score: {typeof hit.relevance === 'number' ? hit.relevance.toFixed(4) : '—'}
        </span>
        {hit.source && (
          <span style={{ fontSize: 'var(--font-xs)', color: '#818cf8', background: '#1e1b4b', padding: '1px 6px', borderRadius: 3, fontFamily: 'monospace', flexShrink: 0 }}>
            {String(hit.source)}
          </span>
        )}
        <span style={{ color: '#475569', fontSize: 'var(--font-xs)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Fields */}
      {open && (
        <div style={{ background: '#0c0e11', padding: '10px 12px' }}>
          {fieldEntries.length === 0 ? (
            <span style={{ color: '#475569', fontSize: 'var(--font-base)', fontFamily: 'monospace' }}>No fields</span>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--font-base)' }}>
              <tbody>
                {fieldEntries.map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #1a1f29' }}>
                    <td style={{ padding: '4px 8px 4px 0', color: '#a78bfa', verticalAlign: 'top', whiteSpace: 'nowrap', width: 1, paddingRight: 16 }}>
                      {k}
                    </td>
                    <td style={{ padding: '4px 0', color: '#e2e8f0', wordBreak: 'break-all' }}>
                      {typeof v === 'object' && v !== null ? (
                        <JsonRenderer data={v} depth={1} />
                      ) : typeof v === 'string' ? (
                        <span style={{ color: '#7dd3fc' }}>{v}</span>
                      ) : typeof v === 'number' ? (
                        <span style={{ color: '#fb923c' }}>{v}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>{String(v)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Main ----
export default function SearchPanel({ vespaUrl, configUrl }: SearchPanelProps) {
  const [yql, setYql] = useState('select * from doc where true')
  const [extraParams, setExtraParams] = useState<Record<string, string>>(
    Object.fromEntries(COMMON_PARAMS.map(p => [p.key, p.default]))
  )
  const [customParams, setCustomParams] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'hits' | 'tree' | 'raw'>('hits')

  const runSearch = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    const start = Date.now()

    const params: Record<string, string> = { yql }
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params[k] = v
    }
    if (customParams.trim()) {
      for (const line of customParams.split('\n')) {
        if (!line.trim()) continue
        const idx = line.indexOf('=')
        if (idx > 0) {
          params[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
        }
      }
    }

    try {
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/search/', method: 'GET', params, vespaUrl, configUrl }),
      })
      const json = await res.json()
      setElapsed(Date.now() - start)
      if (json.ok) {
        setResult(json.data)
      } else {
        setError(json.error || JSON.stringify(json.data))
        setResult(json.data)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const root = result && typeof result === 'object' ? (result as Record<string, unknown>).root as Record<string, unknown> : null
  const totalCount = root?.fields ? (root.fields as Record<string, unknown>).totalCount : null
  const hits: HitData[] = Array.isArray(root?.children) ? (root?.children as HitData[]) : []
  const coverage = root?.coverage as Record<string, unknown> | undefined

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* YQL Editor */}
      <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-sm)', fontWeight: 600, letterSpacing: '0.08em' }}>YQL QUERY</span>
          <button
            onClick={() => setYql('select * from doc where true')}
            style={{ fontSize: 'var(--font-sm)', color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>
        <textarea
          className="code-editor"
          value={yql}
          onChange={e => setYql(e.target.value)}
          rows={4}
          placeholder="select * from sources * where userQuery()"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runSearch() } }}
        />
        <div style={{ fontSize: 'var(--font-sm)', color: '#475569', marginTop: 4 }}>Ctrl+Enter で実行</div>
      </div>

      {/* Parameters */}
      <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14 }}>
        <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-sm)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>PARAMETERS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8, marginBottom: 10 }}>
          {COMMON_PARAMS.map(p => (
            <div key={p.key}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>{p.key}</label>
              <input
                type="text"
                value={extraParams[p.key] || ''}
                onChange={e => setExtraParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                placeholder={p.default || '—'}
                style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 'var(--font-base)', outline: 'none' }}
              />
            </div>
          ))}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>カスタムパラメーター (key=value, 1行1つ)</label>
          <textarea
            value={customParams}
            onChange={e => setCustomParams(e.target.value)}
            rows={2}
            placeholder={"input.query(embedding)=embed(@query)\nranking.features.query(alpha)=0.5"}
            style={{ width: '100%', background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 'var(--font-base)', outline: 'none', resize: 'vertical' }}
          />
        </div>
      </div>

      {/* Execute */}
      <div>
        <button
          onClick={runSearch}
          disabled={loading}
          style={{
            background: loading ? '#1a2a35' : '#00b4d8',
            color: loading ? '#64748b' : '#0c0e11',
            border: 'none', borderRadius: 6, padding: '10px 28px',
            fontWeight: 600, fontSize: 'var(--font-md)', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'IBM Plex Sans', transition: 'background 0.15s',
          }}
        >
          {loading ? '⟳ 実行中...' : '▶ Execute Search'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#1a0f0f', border: '1px solid #ef4444', borderRadius: 6, padding: 12, color: '#ef4444', fontFamily: 'monospace', fontSize: 'var(--font-base)' }}>
          ✗ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* Stats bar */}
          <div style={{
            background: '#13171e', border: '1px solid #252b38', borderRadius: '6px 6px 0 0',
            padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            borderBottom: 'none',
          }}>
            <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-sm)', fontWeight: 600, letterSpacing: '0.08em' }}>RESULTS</span>
            {totalCount !== null && (
              <span style={{ fontSize: 'var(--font-base)', color: '#4ade80', fontFamily: 'monospace' }}>
                totalCount: <strong>{String(totalCount)}</strong>
              </span>
            )}
            {hits.length > 0 && totalCount !== null && hits.length < Number(totalCount) && (
              <span style={{ fontSize: 'var(--font-sm)', color: '#64748b', fontFamily: 'monospace' }}>
                (showing {hits.length})
              </span>
            )}
            {elapsed !== null && (
              <span style={{ fontSize: 'var(--font-sm)', color: '#64748b', fontFamily: 'monospace' }}>{elapsed}ms</span>
            )}
            {coverage && (
              <span style={{ fontSize: 'var(--font-sm)', color: '#64748b', fontFamily: 'monospace' }}>
                coverage: {String(coverage?.coverage ?? 0)}%
              </span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {(['hits', 'tree', 'raw'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ fontSize: 'var(--font-sm)', color: viewMode === m ? '#00b4d8' : '#64748b', background: 'none', border: '1px solid ' + (viewMode === m ? '#00b4d8' : '#252b38'), borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}>
                  {m}
                </button>
              ))}
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                style={{ fontSize: 'var(--font-sm)', color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}
              >
                Copy
              </button>
            </div>
          </div>

          {/* Content */}
          <div style={{ background: '#0c0e11', border: '1px solid #252b38', borderRadius: '0 0 6px 6px', padding: 14 }}>
            {viewMode === 'hits' && (
              <>
                {hits.length === 0 && (
                  <div style={{ color: '#475569', fontFamily: 'monospace', fontSize: 'var(--font-md)', padding: '20px 0', textAlign: 'center' }}>
                    ヒット件数: {String(totalCount ?? 0)}　ドキュメントなし
                  </div>
                )}
                {hits.map((hit, i) => (
                  <HitCard key={hit.id || i} hit={hit} index={i} />
                ))}
              </>
            )}
            {viewMode === 'tree' && (
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--font-base)', lineHeight: 1.7, color: '#e2e8f0' }}>
                <JsonRenderer data={result} depth={0} />
              </div>
            )}
            {viewMode === 'raw' && (
              <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--font-base)', color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
