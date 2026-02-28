'use client'
import { useState, useEffect, useRef } from 'react'
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

const LS_KEY = 'vespa-admin-settings'

function loadSettings() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

export default function Home() {
  const [tab, setTab] = useState('search')
  const [vespaUrl, setVespaUrl] = useState(() => loadSettings().vespaUrl ?? 'http://localhost:8081')
  const [feedUrl, setFeedUrl] = useState(() => loadSettings().feedUrl ?? 'http://localhost:8080')
  const [configUrl, setConfigUrl] = useState(() => loadSettings().configUrl ?? 'http://localhost:19071')
  const [showSettings, setShowSettings] = useState(false)

  // 環境変数からデフォルト設定を取得（設定済みの場合は環境変数を優先）
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/config', { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`config API returned ${res.status}`)
        return res.json()
      })
      .then(cfg => {
        if (cfg.vespaUrl) setVespaUrl(cfg.vespaUrl)
        if (cfg.feedUrl) setFeedUrl(cfg.feedUrl)
        if (cfg.configUrl) setConfigUrl(cfg.configUrl)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.warn('[vespa-admin] /api/config fetch failed:', err)
      })
    return () => controller.abort()
  }, [])
  const [healthStatus, setHealthStatus] = useState<'unknown' | 'up' | 'down'>('unknown')
  const [fontSize, setFontSize] = useState<'medium' | 'large'>('medium')
  const fontSizeRestoredRef = useRef(false)

  // フォントサイズをlocalStorageから復元し、変更時に永続化
  useEffect(() => {
    const saved = localStorage.getItem('vespa-font-size')
    if (saved === 'large') setFontSize('large')
    fontSizeRestoredRef.current = true
  }, [])

  useEffect(() => {
    if (!fontSizeRestoredRef.current) return
    localStorage.setItem('vespa-font-size', fontSize)
  }, [fontSize])

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ vespaUrl, feedUrl, configUrl }))
  }, [vespaUrl, feedUrl, configUrl])

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
    <div className={fontSize === 'large' ? 'font-large' : ''} style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--vespa-bg)' }}>
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
            <span style={{ fontFamily: 'IBM Plex Sans', fontWeight: 600, fontSize: 'var(--font-lg)', color: '#e2e8f0', letterSpacing: '-0.01em' }}>
              Vespa <span style={{ color: '#00b4d8' }}>Admin</span>
            </span>
          </div>

          {/* Health indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, background: healthStatus === 'up' ? '#22c55e15' : healthStatus === 'down' ? '#ef444415' : '#64748b15', border: `1px solid ${healthStatus === 'up' ? '#22c55e40' : healthStatus === 'down' ? '#ef444440' : '#64748b40'}` }}>
            <span className={healthStatus !== 'unknown' ? 'pulse-dot' : ''} style={{ width: 7, height: 7, borderRadius: '50%', background: healthStatus === 'up' ? '#22c55e' : healthStatus === 'down' ? '#ef4444' : '#64748b', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 'var(--font-sm)', fontFamily: 'monospace', color: healthStatus === 'up' ? '#22c55e' : healthStatus === 'down' ? '#ef4444' : '#64748b' }}>
              {healthStatus === 'up' ? 'Connected' : healthStatus === 'down' ? 'Disconnected' : 'Unknown'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', color: '#3a4252', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            query:{vespaUrl.replace('http://','')} / feed:{feedUrl.replace('http://','')}
          </span>
          <button
            onClick={() => setFontSize(fontSize === 'medium' ? 'large' : 'medium')}
            style={{ background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '5px 10px', color: '#64748b', cursor: 'pointer', fontSize: 'var(--font-base)', fontFamily: 'monospace', letterSpacing: '-0.02em' }}
            title={fontSize === 'medium' ? '文字サイズ: 中 (クリックで大に変更)' : '文字サイズ: 大 (クリックで中に変更)'}
            aria-label={fontSize === 'medium' ? '現在の文字サイズは中です。クリックして大に変更します。' : '現在の文字サイズは大です。クリックして中に変更します。'}
            aria-pressed={fontSize === 'large'}>
            {fontSize === 'medium' ? 'A' : <strong>A</strong>}
            <span style={{ fontSize: 'var(--font-xxs)', verticalAlign: 'super', marginLeft: 1 }}>{fontSize === 'medium' ? '中' : '大'}</span>
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            style={{ background: showSettings ? '#1a2a35' : 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '5px 12px', color: showSettings ? 'var(--vespa-accent)' : '#64748b', cursor: 'pointer', fontSize: 'var(--font-base)', fontFamily: 'monospace' }}>
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* Settings Dropdown */}
      {showSettings && (
        <div style={{ background: 'var(--vespa-surface)', borderBottom: '1px solid var(--vespa-border)', padding: '12px 20px', display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: '#64748b', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '0.08em' }}>QUERY CONTAINER URL</label>
            <input type="text" value={vespaUrl} onChange={e => setVespaUrl(e.target.value)}
              style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 'var(--font-base)', outline: 'none', width: 260 }} />
            <div style={{ fontSize: 'var(--font-xs)', color: '#475569', marginTop: 3, fontFamily: 'monospace' }}>Search ・ Health 用 (<code style={{ color: '#a78bfa' }}>&lt;search/&gt;</code> コンテナ)</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: '#64748b', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '0.08em' }}>FEED CONTAINER URL</label>
            <input type="text" value={feedUrl} onChange={e => setFeedUrl(e.target.value)}
              style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 'var(--font-base)', outline: 'none', width: 260 }} />
            <div style={{ fontSize: 'var(--font-xs)', color: '#475569', marginTop: 3, fontFamily: 'monospace' }}>Documents 用 (<code style={{ color: '#a78bfa' }}>&lt;document-api/&gt;</code> コンテナ)</div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: '#64748b', fontFamily: 'monospace', marginBottom: 4, letterSpacing: '0.08em' }}>CONFIG SERVER URL</label>
            <input type="text" value={configUrl} onChange={e => setConfigUrl(e.target.value)}
              style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 'var(--font-base)', outline: 'none', width: 260 }} />
            <div style={{ fontSize: 'var(--font-xs)', color: '#475569', marginTop: 3, fontFamily: 'monospace' }}>Schema ・ Logs 用 (port 19071)</div>
          </div>
          <div>
            <button
              onClick={() => { setVespaUrl('http://localhost:8081'); setFeedUrl('http://localhost:8080'); setConfigUrl('http://localhost:19071') }}
              style={{ background: 'none', border: '1px solid #334155', borderRadius: 4, padding: '6px 12px', color: '#64748b', cursor: 'pointer', fontSize: 'var(--font-sm)', fontFamily: 'monospace' }}
            >
              ↺ Reset defaults
            </button>
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
              fontSize: 'var(--font-md)',
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
        {tab === 'document' && <DocumentPanel vespaUrl={feedUrl} configUrl={configUrl} />}
        {tab === 'trace' && <TracePanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'schema' && <SchemaPanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'health' && <HealthPanel vespaUrl={vespaUrl} configUrl={configUrl} />}
        {tab === 'logs' && <LogsPanel />}
      </main>
    </div>
  )
}
