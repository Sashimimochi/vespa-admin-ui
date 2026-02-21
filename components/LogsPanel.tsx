'use client'
import { useState, useCallback } from 'react'

interface LogLine {
  timestamp: string
  level: string
  component: string
  message: string
  raw: string
}

const LEVELS = ['all', 'error', 'warning', 'info', 'debug', 'fine']
const LEVEL_COLORS: Record<string, string> = {
  error: '#ef4444', fatal: '#ef4444',
  warning: '#f59e0b', warn: '#f59e0b',
  info: '#22c55e',
  debug: '#818cf8',
  fine: '#64748b', finest: '#64748b', finer: '#64748b',
  config: '#00b4d8',
}

function parseVespaLog(raw: string): LogLine[] {
  return raw.split('\n').filter(Boolean).map(line => {
    // Vespa log format: timestamp\thost\tpid\tservice\tcomponent\tlevel\tmessage
    const parts = line.split('\t')
    if (parts.length >= 7) {
      return {
        timestamp: parts[0],
        level: parts[5].toLowerCase(),
        component: parts[4] || parts[3],
        message: parts.slice(6).join('\t'),
        raw: line,
      }
    }
    // Try JSON format
    try {
      const obj = JSON.parse(line)
      return {
        timestamp: obj.timestamp || obj.time || '',
        level: (obj.level || obj.severity || 'info').toLowerCase(),
        component: obj.logger || obj.component || '',
        message: obj.message || obj.msg || line,
        raw: line,
      }
    } catch {
      return { timestamp: '', level: 'info', component: '', message: line, raw: line }
    }
  })
}

export default function LogsPanel() {
  const [logs, setLogs] = useState<LogLine[]>([])
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterText, setFilterText] = useState('')
  const [pastedLog, setPastedLog] = useState('')

  const parseLogs = useCallback(() => {
    setLogs(parseVespaLog(pastedLog))
  }, [pastedLog])

  const filtered = logs.filter(l => {
    if (filterLevel !== 'all' && l.level !== filterLevel) return false
    if (filterText && !l.message.toLowerCase().includes(filterText.toLowerCase()) && !l.component.toLowerCase().includes(filterText.toLowerCase())) return false
    return true
  })

  const levelCounts = logs.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] || 0) + 1
    return acc
  }, {})

  return (
    <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 14 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>PASTE LOGS</span>
        </div>
        <div>
          <textarea
            value={pastedLog}
            onChange={e => setPastedLog(e.target.value)}
            rows={5}
            placeholder="Paste Vespa log content here (vespa-logfmt format or JSON lines)..."
            style={{ width: '100%', background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, outline: 'none', resize: 'vertical' }}
          />
          <button onClick={parseLogs} style={{ marginTop: 8, background: 'var(--vespa-accent)', color: '#0c0e11', border: 'none', borderRadius: 6, padding: '7px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'IBM Plex Sans' }}>
            Parse Logs
          </button>
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.6 }}>
          To export from Vespa container: <code style={{ color: '#a8d8ea' }}>vespa-logfmt -l all /opt/vespa/logs/vespa/vespa.log | tail -500</code>
        </div>
      </div>

      {/* Level stats */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(levelCounts).sort(([,a],[,b]) => b-a).map(([level, count]) => (
            <span key={level} style={{ fontSize: 11, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 4, background: (LEVEL_COLORS[level] || '#64748b') + '20', color: LEVEL_COLORS[level] || '#64748b', border: '1px solid ' + (LEVEL_COLORS[level] || '#64748b') + '40' }}>
              {level}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      {logs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
            placeholder="Filter messages..."
            style={{ flex: 1, minWidth: 200, background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '6px 10px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none' }} />
          {LEVELS.map(l => (
            <button key={l} onClick={() => setFilterLevel(l)}
              style={{ fontSize: 10, color: filterLevel === l ? (LEVEL_COLORS[l] || '#e2e8f0') : '#64748b', background: 'none', border: '1px solid ' + (filterLevel === l ? (LEVEL_COLORS[l] || '#e2e8f0') : 'var(--vespa-border)'), borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontFamily: 'monospace' }}>
              {l}
            </button>
          ))}
          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{filtered.length}/{logs.length}</span>
        </div>
      )}

      {/* Log Lines */}
      {filtered.length > 0 && (
        <div style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 6, overflow: 'auto', flex: 1, minHeight: 300 }}>
          <div style={{ display: 'table', width: '100%', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
            {filtered.map((line, i) => (
              <div key={i} style={{ display: 'flex', gap: 0, borderBottom: '1px solid #1a1f29', minWidth: 0 }}>
                <span style={{ padding: '3px 8px', color: '#3a4252', flexShrink: 0, width: 40, textAlign: 'right', borderRight: '1px solid var(--vespa-border)' }}>{i+1}</span>
                <span style={{ padding: '3px 6px', color: '#64748b', flexShrink: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--vespa-border)' }}>
                  {line.timestamp.split('T').pop()?.split('.')[0] || line.timestamp}
                </span>
                <span style={{ padding: '3px 6px', flexShrink: 0, width: 64, textAlign: 'center', color: LEVEL_COLORS[line.level] || '#64748b', fontWeight: 600, borderRight: '1px solid var(--vespa-border)' }}>
                  {line.level.toUpperCase().slice(0, 4)}
                </span>
                <span style={{ padding: '3px 6px', color: '#818cf8', flexShrink: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderRight: '1px solid var(--vespa-border)' }}>
                  {line.component}
                </span>
                <span style={{ padding: '3px 8px', color: '#cbd5e1', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {line.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#3a4252', fontFamily: 'monospace', fontSize: 13, flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 32 }}>📋</span>
          <span>No logs loaded yet</span>
        </div>
      )}
    </div>
  )
}
