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

function JsonRenderer({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [collapsed, setCollapsed] = useState(depth > 2)
  const indent = depth * 16

  if (data === null) return <span style={{ color: '#64748b' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: '#22c55e' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: '#f59e0b' }}>{data}</span>
  if (typeof data === 'string') return <span style={{ color: '#a8d8ea' }}>"{data}"</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#64748b' }}>[]</span>
    return (
      <span>
        <button onClick={() => setCollapsed(!collapsed)} style={{ color: '#64748b', fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
          {collapsed ? '▶' : '▼'}
        </button>
        {collapsed ? (
          <span style={{ color: '#64748b' }}>[{data.length} items]</span>
        ) : (
          <span>
            {'['}
            <div style={{ marginLeft: indent + 16 }}>
              {data.map((item, i) => (
                <div key={i}>
                  <JsonRenderer data={item} depth={depth + 1} />
                  {i < data.length - 1 && <span style={{ color: '#64748b' }}>,</span>}
                </div>
              ))}
            </div>
            {']'}
          </span>
        )}
      </span>
    )
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data as object)
    if (keys.length === 0) return <span style={{ color: '#64748b' }}>{'{}'}</span>
    return (
      <span>
        <button onClick={() => setCollapsed(!collapsed)} style={{ color: '#64748b', fontFamily: 'monospace', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
          {collapsed ? '▶' : '▼'}
        </button>
        {collapsed ? (
          <span style={{ color: '#64748b' }}>{`{${keys.length} keys}`}</span>
        ) : (
          <span>
            {'{'}
            <div style={{ marginLeft: indent + 16 }}>
              {keys.map((k, i) => (
                <div key={k}>
                  <span style={{ color: '#818cf8' }}>"{k}"</span>
                  <span style={{ color: '#64748b' }}>: </span>
                  <JsonRenderer data={(data as Record<string, unknown>)[k]} depth={depth + 1} />
                  {i < keys.length - 1 && <span style={{ color: '#64748b' }}>,</span>}
                </div>
              ))}
            </div>
            {'}'}
          </span>
        )}
      </span>
    )
  }
  return <span>{String(data)}</span>
}

export default function SearchPanel({ vespaUrl, configUrl }: SearchPanelProps) {
  const [yql, setYql] = useState("select * from sources * where true limit 5")
  const [extraParams, setExtraParams] = useState<Record<string, string>>(
    Object.fromEntries(COMMON_PARAMS.map(p => [p.key, p.default]))
  )
  const [customParams, setCustomParams] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree')

  const runSearch = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    const start = Date.now()

    const params: Record<string, string> = { yql }
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params[k] = v
    }
    // Parse custom params
    if (customParams.trim()) {
      for (const line of customParams.split('\n')) {
        const [k, ...rest] = line.split('=')
        if (k && rest.length) params[k.trim()] = rest.join('=').trim()
      }
    }

    try {
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/search/', method: 'GET', params, vespaUrl, configUrl })
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

  const totalHits = result && typeof result === 'object' && 'root' in (result as object)
    ? (result as Record<string, Record<string, unknown>>).root?.fields?.totalCount
    : null

  return (
    <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* YQL Editor */}
      <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>YQL QUERY</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setYql("select * from sources * where true limit 5")}
              style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
              Reset
            </button>
          </div>
        </div>
        <textarea
          className="code-editor"
          value={yql}
          onChange={e => setYql(e.target.value)}
          rows={4}
          placeholder="select * from sources * where userQuery()"
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runSearch() } }}
        />
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Ctrl+Enter to execute</div>
      </div>

      {/* Parameters Grid */}
      <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
        <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>PARAMETERS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 12 }}>
          {COMMON_PARAMS.map(p => (
            <div key={p.key}>
              <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>{p.key}</label>
              <input
                type="text"
                value={extraParams[p.key] || ''}
                onChange={e => setExtraParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                placeholder={p.default || '—'}
                style={{
                  width: '100%', background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)',
                  borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none'
                }}
              />
            </div>
          ))}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: '#64748b', marginBottom: 3, fontFamily: 'monospace' }}>Custom params (key=value, one per line)</label>
          <textarea
            value={customParams}
            onChange={e => setCustomParams(e.target.value)}
            rows={2}
            placeholder={"input.query(embedding)=embed(@query)\nranking.features.query(alpha)=0.5"}
            style={{
              width: '100%', background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)',
              borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none', resize: 'vertical'
            }}
          />
        </div>
      </div>

      {/* Execute Button */}
      <button
        onClick={runSearch}
        disabled={loading}
        style={{
          background: loading ? '#1a2a35' : 'var(--vespa-accent)',
          color: loading ? '#64748b' : '#0c0e11',
          border: 'none', borderRadius: 6, padding: '10px 24px',
          fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'IBM Plex Sans', letterSpacing: '0.02em',
          transition: 'background 0.15s',
          alignSelf: 'flex-start'
        }}
      >
        {loading ? '⟳ Running...' : '▶ Execute Search'}
      </button>

      {/* Results */}
      {(result || error) && (
        <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>RESULTS</span>
              {totalHits !== null && <span style={{ fontSize: 11, color: '#22c55e', fontFamily: 'monospace' }}>totalCount: {String(totalHits)}</span>}
              {elapsed !== null && <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{elapsed}ms</span>}
              {error && <span style={{ fontSize: 11, color: '#ef4444' }}>Error</span>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['tree', 'raw'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ fontSize: 11, color: viewMode === m ? 'var(--vespa-accent)' : '#64748b', background: 'none', border: '1px solid ' + (viewMode === m ? 'var(--vespa-accent)' : 'var(--vespa-border)'), borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
              <button onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                style={{ fontSize: 11, color: '#64748b', background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>
                Copy
              </button>
            </div>
          </div>
          <div style={{ overflow: 'auto', flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
            {viewMode === 'raw' ? (
              <pre style={{ color: '#e2e8f0', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            ) : (
              <div>
                <JsonRenderer data={result} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
