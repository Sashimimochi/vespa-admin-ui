'use client'
import { useState, useEffect } from 'react'
import SearchPanel from '../components/SearchPanel'
import TracePanel from '../components/TracePanel'
import SchemaPanel from '../components/SchemaPanel'
import HealthPanel from '../components/HealthPanel'
import LogsPanel from '../components/LogsPanel'
import DocumentPanel from '../components/DocumentPanel'

const TABS = [
  { id: 'search', label: '🔍 Search', short: 'Search' },
  { id: 'document', label: '📥 Documents', short: 'Documents' },
  { id: 'trace', label: '🔬 Query Trace', short: 'Trace' },
  { id: 'schema', label: '🗄️ Schema / Config', short: 'Schema' },
  { id: 'health', label: '💚 Health', short: 'Health' },
  { id: 'logs', label: '📋 Logs', short: 'Logs' },
]

export default function Home() {
  const [tab, setTab] = useState('search')
  const [vespaUrl, setVespaUrl] = useState('http://localhost:8080')
  const [configUrl, setConfigUrl] = useState('http://localhost:19071')
  const [showSettings, setShowSettings] = useState(false)
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'up' | 'down'>('unknown')

  // Quick health ping
  useEffect(() => {
    const ping = async () => {
      try {
        const res = await fetch('/api/vespa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: '/state/v1/health', method: 'GET', vespaUrl, configUrl })
        })
        const json = await res.json()
        setHealthStatus(json.ok ? 'up' : 'down')
      } catch {
        setHealthStatus('down')
      }
    }
    ping()
    const id = setInterval(ping, 30000)
    return () => clearInterval(id)
  }, [vespaUrl, configUrl])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--vespa-bg)' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52,
        borderBottom: '1px solid var(--vespa-border)',
        background: 'var(--vespa-surface)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect width="22" height="22" rx="4" fill="#00b4d8" fillOpacity="0.15" />
              <circle cx="11" cy="11" r="7" stroke="#00b4d8" strokeWidth="1.5" fill="none" />
              <circle cx="11" cy="11" r="3" fill="#00b4d8" />
              <line x1="16" y1="16" x2="20" y2="20" stroke="#00b4d8" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: 'IBM Plex Sans', fontWeight: 600, fontSize: 15, color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Vespa <span style={{ color: '#00b4d8' }}>Admin</span>
            </span>
          </div>

          {/* Health indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: healthStatus === 'up' ? '#22c55e15' : healthStatus === 'down' ? '#ef444415' : '#64748b15', border: `1px solid ${healthStatus === 'up' ? '#22c55e40' : healthStatus === 'down' ? '#ef444440' : '#64748b40'}` }}>
            <span className={healthStatus !== 'unknown' ? 'pulse-dot' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: healthStatus === 'up' ? '#22c55e' : healthStatus === 'down' ? '#ef4444' : '#64748b', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: healthStatus === 'up' ? '#22c55e' : healthStatus === 'down' ? '#ef4444' : '#64748b' }}>
              {healthStatus === 'up' ? 'Connected' : healthStatus === 'down' ? 'Disconnected' : 'Unknown'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#3a4252', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {vespaUrl}
          </span>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: showSettings ? '#1a2a35' : 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '5px 12px', color: showSettings ? 'var(--vespa-accent)' : '#64748b', cursor: 'pointer', fontSize: 12, fontFamily: 'monospace' }}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* Settings Dropdown */}
      {showSettings && (
        <div style={{ background: 'var(--vespa-surface)', borderBottom: '1px solid var(--vespa-border)', padding: '12px 20px', display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '0.08em' }}>VESPA CONTAINER URL</label>
            <input type="text" value={vespaUrl} onChange={e => setVespaUrl(e.target.value)}
              style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none', width: 280 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: '#64748b', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '0.08em' }}>CONFIG SERVER URL</label>
            <input type="text" value={configUrl} onChange={e => setConfigUrl(e.target.value)}
              style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none', width: 280 }} />
          </div>
          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', paddingBottom: 6, lineHeight: 1.6 }}>
            Default ports: Container=8080, Config Server=19071
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 0,
        borderBottom: '1px solid var(--vespa-border)',
        background: 'var(--vespa-surface)',
        paddingLeft: 8,
        flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 18px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--vespa-accent)' : '2px solid transparent',
              color: tab === t.id ? '#e2e8f0' : '#64748b',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'IBM Plex Sans',
              fontWeight: tab === t.id ? 500 : 400,
              transition: 'color 0.15s, border-color 0.15s',
              whiteSpace: 'nowrap',
            }}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {tab === 'search' && <SearchPanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'document' && <DocumentPanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'trace' && <TracePanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'schema' && <SchemaPanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'health' && <HealthPanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'logs' && <LogsPanel />}
      </main>
    </div>
  )
}
