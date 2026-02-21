'use client'
import { useState, useEffect, useCallback } from 'react'

interface SchemaPanelProps { vespaUrl: string; configUrl: string }

interface FileNode { name: string; type: 'file' | 'dir'; path: string; children?: FileNode[] }

function FileTree({ nodes, onSelect, selected }: { nodes: FileNode[]; onSelect: (f: FileNode) => void; selected?: string }) {
  return (
    <div>
      {nodes.map(n => (
        <div key={n.path}>
          <button
            onClick={() => n.type === 'file' && onSelect(n)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
              background: selected === n.path ? '#1a2a35' : 'none',
              border: 'none', borderLeft: selected === n.path ? '2px solid var(--vespa-accent)' : '2px solid transparent',
              padding: '4px 8px', cursor: n.type === 'file' ? 'pointer' : 'default',
              color: n.type === 'dir' ? '#818cf8' : '#e2e8f0',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            }}>
            <span>{n.type === 'dir' ? '📁' : '📄'}</span>
            {n.name}
          </button>
          {n.children && (
            <div style={{ paddingLeft: 16 }}>
              <FileTree nodes={n.children} onSelect={onSelect} selected={selected} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function highlight(content: string, ext: string): React.ReactNode {
  // Simple syntax highlighting for sd files
  if (ext === 'sd' || ext === 'xml') {
    const lines = content.split('\n')
    return lines.map((line, i) => {
      let color = '#e2e8f0'
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) color = '#64748b'
      else if (trimmed.startsWith('field ') || trimmed.startsWith('rank-profile') || trimmed.startsWith('document ') || trimmed.startsWith('schema ')) color = '#00b4d8'
      else if (trimmed.startsWith('indexing:') || trimmed.startsWith('index:') || trimmed.startsWith('attribute') || trimmed.startsWith('expression:')) color = '#818cf8'
      else if (trimmed.startsWith('function ') || trimmed.startsWith('first-phase') || trimmed.startsWith('second-phase') || trimmed.startsWith('global-phase')) color = '#f59e0b'
      else if (trimmed.startsWith('<') && ext === 'xml') color = '#00b4d8'
      return <div key={i} style={{ color }}>{line || ' '}</div>
    })
  }
  return <pre style={{ margin: 0, color: '#e2e8f0' }}>{content}</pre>
}

export default function SchemaPanel({ vespaUrl, configUrl }: SchemaPanelProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [selected, setSelected] = useState<FileNode | null>(null)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tenant, setTenant] = useState('default')
  const [app, setApp] = useState('default')

  const baseEndpoint = `/application/v2/tenant/${tenant}/application/${app}`

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Get application package file list
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: `${baseEndpoint}/content/`, method: 'GET', vespaUrl, configUrl })
      })
      const json = await res.json()
      if (json.ok && Array.isArray(json.data)) {
        // Build file tree from flat list
        const tree = buildTree(json.data as string[])
        setFiles(tree)
      } else {
        // Try to get active config/deployment
        setError('Could not fetch application package. Is config server accessible? ' + (json.error || ''))
        // Create dummy tree showing common files
        setFiles([
          { name: 'schemas/', type: 'dir', path: 'schemas/', children: [] },
          { name: 'services.xml', type: 'file', path: 'services.xml' },
          { name: 'hosts.xml', type: 'file', path: 'hosts.xml' },
        ])
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }, [baseEndpoint, vespaUrl, configUrl])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const fetchFile = async (file: FileNode) => {
    setSelected(file)
    setContent('')
    try {
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: `${baseEndpoint}/content/${file.path}`, method: 'GET', vespaUrl, configUrl })
      })
      const json = await res.json()
      setContent(typeof json.data === 'string' ? json.data : JSON.stringify(json.data, null, 2))
    } catch (e: unknown) {
      setContent('Error: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const ext = selected?.name.split('.').pop() || ''

  return (
    <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Config */}
      <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em' }}>APP PACKAGE</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', display: 'block', fontFamily: 'monospace' }}>tenant</label>
              <input type="text" value={tenant} onChange={e => setTenant(e.target.value)}
                style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '3px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none', width: 100 }} />
            </div>
            <div>
              <label style={{ fontSize: 10, color: '#64748b', display: 'block', fontFamily: 'monospace' }}>application</label>
              <input type="text" value={app} onChange={e => setApp(e.target.value)}
                style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '3px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 12, outline: 'none', width: 100 }} />
            </div>
          </div>
          <button onClick={fetchFiles} disabled={loading}
            style={{ background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '4px 12px', color: '#e2e8f0', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'monospace' }}>
            {loading ? '⟳' : '↻ Load'}
          </button>
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 11, color: '#f59e0b', fontFamily: 'monospace' }}>⚠ {error}</div>}
      </div>

      {/* Split view */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* File tree */}
        <div style={{ width: 220, flexShrink: 0, background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, overflow: 'auto', padding: 8 }}>
          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', padding: '4px 8px', marginBottom: 4, letterSpacing: '0.08em' }}>FILES</div>
          {files.length === 0 && !loading && (
            <div style={{ fontSize: 11, color: '#64748b', padding: '8px', fontFamily: 'monospace' }}>No files found</div>
          )}
          <FileTree nodes={files} onSelect={fetchFile} selected={selected?.path} />
        </div>

        {/* Content viewer */}
        <div style={{ flex: 1, background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {selected ? (
            <>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--vespa-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#818cf8' }}>{selected.path}</span>
                <button onClick={() => navigator.clipboard.writeText(content)}
                  style={{ fontSize: 10, color: '#64748b', background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', fontFamily: 'monospace' }}>
                  Copy
                </button>
              </div>
              <div style={{ overflow: 'auto', flex: 1, padding: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.7 }}>
                {highlight(content, ext)}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#3a4252', fontFamily: 'monospace', fontSize: 12 }}>
              Select a file to view
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function buildTree(paths: string[]): FileNode[] {
  const root: Record<string, FileNode> = {}

  for (const p of paths) {
    const parts = p.replace(/^\//, '').split('/')
    let current = root
    let currentPath = ''
    for (let i = 0; i < parts.length; i++) {
      currentPath += (i > 0 ? '/' : '') + parts[i]
      if (!current[parts[i]]) {
        current[parts[i]] = {
          name: parts[i],
          type: i === parts.length - 1 ? 'file' : 'dir',
          path: currentPath,
          children: i < parts.length - 1 ? [] : undefined,
        }
      }
      if (i < parts.length - 1 && current[parts[i]].children) {
        const next: Record<string, FileNode> = {}
        for (const child of current[parts[i]].children!) {
          next[child.name] = child
        }
        current = next
        // Re-attach children
        current[parts[i+1]] = current[parts[i+1]] || {
          name: parts[i+1],
          type: i+1 === parts.length - 1 ? 'file' : 'dir',
          path: currentPath + '/' + parts[i+1],
          children: i+1 < parts.length - 1 ? [] : undefined,
        }
      }
    }
  }

  // Simpler flat approach - just show files as list
  return paths.map(p => ({
    name: p.split('/').pop() || p,
    type: p.endsWith('/') ? 'dir' as const : 'file' as const,
    path: p.replace(/^\//, ''),
  }))
}
