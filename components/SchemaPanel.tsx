'use client'
import { useState, useCallback } from 'react'

interface SchemaPanelProps { vespaUrl: string; configUrl: string }

// ---- Syntax highlight ----
function HighlightedCode({ content, ext }: { content: string; ext: string }) {
  const lines = content.split('\n')
  return (
    <div>
      {lines.map((line, i) => {
        let color = '#e2e8f0'
        const t = line.trim()
        if (ext === 'sd') {
          if (t.startsWith('#')) color = '#64748b'
          else if (/^(schema|document|field|fieldset|rank-profile|document-summary|summary|constant|onnx-model|component)\b/.test(t)) color = '#38bdf8'
          else if (/^(indexing|index|attribute|bolding|dynamic-summary|weight|match|normalizing|stemming|alias)\b/.test(t)) color = '#a78bfa'
          else if (/^(function|expression|first-phase|second-phase|global-phase|match-features|rank-features|inputs|output)\b/.test(t)) color = '#fb923c'
          else if (/^(type|struct-field|inherits|from-disk)\b/.test(t)) color = '#4ade80'
        } else if (ext === 'xml') {
          if (t.startsWith('<!--')) color = '#64748b'
          else if (t.startsWith('</')) color = '#7dd3fc'
          else if (t.startsWith('<')) color = '#38bdf8'
        } else if (ext === 'json') {
          if (/"[^"]+"\s*:/.test(t)) color = '#a78bfa'
        }
        return (
          <div key={i} style={{ display: 'flex', minHeight: '1.6em' }}>
            <span style={{ color: '#2d3748', userSelect: 'none', minWidth: 40, textAlign: 'right', paddingRight: 14, flexShrink: 0, fontSize: 'var(--font-sm)' }}>
              {i + 1}
            </span>
            <span style={{ color, whiteSpace: 'pre', flex: 1 }}>{line || ' '}</span>
          </div>
        )
      })}
    </div>
  )
}

// ---- File Tree ----
interface FileEntry {
  name: string       // ファイル名 (e.g. "music.sd")
  path: string       // 相対パス (e.g. "schemas/music.sd")
  fetchUrl: string   // 取得用フルURL (Config Server が返してくれたURL)
  isDir: boolean
}

function buildFileTree(entries: FileEntry[]): Record<string, FileEntry[]> {
  const groups: Record<string, FileEntry[]> = {}
  for (const e of entries) {
    if (e.isDir) continue
    const parts = e.path.split('/')
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)'
    if (!groups[dir]) groups[dir] = []
    groups[dir].push(e)
  }
  return groups
}

function extIcon(name: string) {
  if (name.endsWith('.sd')) return '📋'
  if (name.endsWith('.xml')) return '🗂'
  if (name.endsWith('.json')) return '{ }'
  if (name.endsWith('.profile')) return '⚡'
  if (name.endsWith('.model')) return '🧠'
  return '📄'
}

// ---- Parse URL list from Vespa API ----
// レスポンスは ["http://host:19071/application/v2/.../content/schemas/music.sd", ...] という形式
function parseUrlList(data: unknown, contentPrefix: string): FileEntry[] {
  if (!Array.isArray(data)) return []

  const entries: FileEntry[] = []
  for (const item of data) {
    const url = typeof item === 'string' ? item : null
    if (!url) continue

    // contentPrefix以降を相対パスとして取り出す
    const idx = url.indexOf(contentPrefix)
    if (idx === -1) continue

    const relativePath = url.slice(idx + contentPrefix.length).replace(/^\//, '')
    const isDir = url.endsWith('/')
    const name = relativePath.replace(/\/$/, '').split('/').pop() || relativePath

    entries.push({ name, path: relativePath.replace(/\/$/, ''), fetchUrl: url, isDir })
  }
  return entries
}

// ---- Main ----
export default function SchemaPanel({ vespaUrl, configUrl }: SchemaPanelProps) {
  const [tenant, setTenant] = useState('default')
  const [application, setApplication] = useState('default')
  const [environment, setEnvironment] = useState('prod')
  const [region, setRegion] = useState('default')
  const [instance, setInstance] = useState('default')

  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [fileContent, setFileContent] = useState('')

  const [loading, setLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [error, setError] = useState('')

  const addLog = (msg: string) => setLogs(prev => [...prev, msg])

  // ---- ファイル一覧取得 ----
  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError('')
    setLogs([])
    setFiles([])
    setSelectedFile(null)
    setFileContent('')

    // 試みる環境パターン一覧
    const envPatterns = [
      { env: environment, region, instance },
      { env: 'prod', region: 'default', instance: 'default' },
      { env: 'default', region: 'default', instance: 'default' },
    ]

    // 重複除去
    const seen = new Set<string>()
    const patterns = envPatterns.filter(p => {
      const key = `${p.env}/${p.region}/${p.instance}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    let success = false

    for (const p of patterns) {
      // アプリレベルの content パス
      // ドキュメント: GET /application/v2/tenant/{t}/application/{a}/environment/{e}/region/{r}/instance/{i}/content/{path}
      const contentBase = `/application/v2/tenant/${tenant}/application/${application}/environment/${p.env}/region/${p.region}/instance/${p.instance}/content/`

      addLog(`試行: ${contentBase}?recursive=true`)
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `${contentBase}?recursive=true`,
          method: 'GET',
          vespaUrl,
          configUrl,
        }),
      })
      const json = await res.json()
      addLog(`→ HTTP ${json.status ?? (json.ok ? 200 : 'error')}`)

      if (json.ok && Array.isArray(json.data) && (json.data as unknown[]).length > 0) {
        // URLからcontent/以降の部分を取り出す
        // "http://host:19071/.../content/"
        // contentBase はエンドポイントパス、実際の取得元URLを再構築
        const contentPrefix = `content/`
        const entries = parseUrlList(json.data, contentPrefix)
        const nonDirEntries = entries.filter(e => !e.isDir)
        addLog(`✓ ${nonDirEntries.length} ファイル取得 (env=${p.env}, region=${p.region})`)
        setFiles(nonDirEntries)
        // 環境が違った場合はフォームも更新
        setEnvironment(p.env)
        setRegion(p.region)
        setInstance(p.instance)
        success = true
        break
      }
    }

    // ---- セッションAPIフォールバック ----
    const trySessionApi = async () => {
      // まずアクティブアプリのURLを取得
      const activeRes = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/application/v2/tenant/${tenant}/application/${application}`,
          method: 'GET',
          vespaUrl,
          configUrl,
        }),
      })
      const activeJson = await activeRes.json()
      addLog(`GET /application/v2/tenant/${tenant}/application/${application} → ${activeJson.status}`)

      // generationからsession-idを推測、またはsession一覧を取得
      const sessionListRes = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: `/application/v2/tenant/${tenant}/session`,
          method: 'GET',
          vespaUrl,
          configUrl,
        }),
      })
      const sessionJson = await sessionListRes.json()
      addLog(`GET /application/v2/tenant/${tenant}/session → ${sessionJson.status}`)

      // セッション一覧から最新のものを取得
      let sessionId: string | null = null
      if (sessionJson.ok && Array.isArray(sessionJson.data) && sessionJson.data.length > 0) {
        const sessions = sessionJson.data as string[]
        // 最後のセッションID (URLから取り出す)
        const lastSessionUrl = sessions[sessions.length - 1]
        const match = lastSessionUrl.match(/\/session\/(\d+)/)
        if (match) sessionId = match[1]
      }

      if (!sessionId) {
        // generationをsession-idとして試す
        const gen = (activeJson.data as Record<string, unknown>)?.generation
        sessionId = gen ? String(gen) : null
      }

      if (sessionId) {
        addLog(`セッション ${sessionId} のファイル一覧を取得...`)
        const contentRes = await fetch('/api/vespa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: `/application/v2/tenant/${tenant}/session/${sessionId}/content/?recursive=true`,
            method: 'GET',
            vespaUrl,
            configUrl,
          }),
        })
        const contentJson = await contentRes.json()
        addLog(`→ HTTP ${contentJson.status}`)

        if (contentJson.ok && Array.isArray(contentJson.data)) {
          const entries = parseUrlList(contentJson.data, 'content/')
          const nonDirEntries = entries.filter(e => !e.isDir)
          if (nonDirEntries.length > 0) {
            addLog(`✓ セッション ${sessionId} から ${nonDirEntries.length} ファイル取得`)
            setFiles(nonDirEntries)
            return
          }
        }
      }

      setError(
        `ファイル一覧を取得できませんでした。\n` +
        `Config Server (${configUrl}) の /application/v2/tenant/${tenant}/application/${application}/environment/.../content/ が応答していません。\n` +
        `テナント名・アプリ名・環境名を確認してください。`
      )
    }

    if (!success) {
      // フォールバック: session-based API で最新セッションから取得
      addLog('アプリ content API 失敗 → セッション API を試みます...')
      await trySessionApi()
    }

    setLoading(false)
  }, [tenant, application, environment, region, instance, vespaUrl, configUrl])

  // ---- ファイル内容取得 ----
  // fetchUrl は "http://host:19071/application/v2/.../content/schemas/music.sd" の形式
  // API route に渡す endpoint はパス部分だけ
  const openFile = async (file: FileEntry) => {
    setSelectedFile(file)
    setFileContent('')
    setFileLoading(true)

    try {
      // fetchUrl からホスト部分を除いたパスを取り出す
      const url = new URL(file.fetchUrl)
      const endpoint = url.pathname  // e.g. /application/v2/tenant/.../content/schemas/music.sd

      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, method: 'GET', vespaUrl, configUrl }),
      })
      const json = await res.json()

      if (json.ok) {
        setFileContent(typeof json.data === 'string' ? json.data : JSON.stringify(json.data, null, 2))
      } else {
        setFileContent(`// Error fetching ${file.path}\n// HTTP ${json.status}: ${json.error || JSON.stringify(json.data)}`)
      }
    } catch (e) {
      setFileContent(`// Exception: ${e}`)
    }

    setFileLoading(false)
  }

  const groups = buildFileTree(files)
  const ext = selectedFile?.name.split('.').pop() || ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Config bar */}
      <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 14 }}>
        <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-sm)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>
          APPLICATION PACKAGE
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'tenant', value: tenant, set: setTenant, w: 110 },
            { label: 'application', value: application, set: setApplication, w: 110 },
            { label: 'environment', value: environment, set: setEnvironment, w: 90 },
            { label: 'region', value: region, set: setRegion, w: 90 },
            { label: 'instance', value: instance, set: setInstance, w: 90 },
          ].map(({ label, value, set, w }) => (
            <div key={label}>
              <label style={{ display: 'block', fontSize: 'var(--font-xs)', color: '#64748b', fontFamily: 'monospace', marginBottom: 3 }}>{label}</label>
              <input type="text" value={value} onChange={e => set(e.target.value)}
                style={{ background: '#0c0e11', border: '1px solid #252b38', borderRadius: 4, padding: '5px 8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: 'var(--font-base)', outline: 'none', width: w }} />
            </div>
          ))}
          <button onClick={loadFiles} disabled={loading}
            style={{ background: loading ? '#1a2a35' : '#00b4d8', color: loading ? '#64748b' : '#0c0e11', border: 'none', borderRadius: 6, padding: '7px 18px', fontWeight: 600, fontSize: 'var(--font-md)', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'IBM Plex Sans', whiteSpace: 'nowrap' }}>
            {loading ? '⟳ Loading...' : '⬇ ファイル一覧を取得'}
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 'var(--font-xs)', color: '#334155', fontFamily: 'monospace', lineHeight: 1.6 }}>
          API: GET {configUrl}/application/v2/tenant/{tenant}/application/{application}/environment/{environment}/region/{region}/instance/{instance}/content/?recursive=true
        </div>

        {/* Log */}
        {logs.length > 0 && (
          <div style={{ marginTop: 10, background: '#0c0e11', borderRadius: 4, padding: '8px 10px', maxHeight: 140, overflow: 'auto' }}>
            {logs.map((l, i) => (
              <div key={i} style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', lineHeight: 1.7,
                color: l.startsWith('✓') ? '#4ade80' : l.startsWith('試行') ? '#00b4d8' : l.includes('失敗') || l.toLowerCase().includes('error') ? '#fbbf24' : '#64748b' }}>
                {l}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 10, background: '#1a0f0f', border: '1px solid #ef4444', borderRadius: 4, padding: '8px 10px', color: '#fca5a5', fontFamily: 'monospace', fontSize: 'var(--font-sm)', whiteSpace: 'pre-wrap' }}>
            {error}
          </div>
        )}
      </div>

      {/* Split view */}
      {files.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 12, minHeight: 500 }}>
          {/* File tree */}
          <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, overflow: 'auto', padding: '8px 0' }}>
            <div style={{ fontSize: 'var(--font-xs)', color: '#475569', fontFamily: 'monospace', padding: '2px 12px 8px', letterSpacing: '0.08em' }}>
              {files.length} ファイル
            </div>
            {Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([dir, entries]) => (
              <div key={dir}>
                <div style={{ fontSize: 'var(--font-xs)', color: '#818cf8', fontFamily: 'monospace', padding: '6px 12px 2px', letterSpacing: '0.05em' }}>
                  {dir === '(root)' ? '📁 /' : `📁 ${dir}/`}
                </div>
                {entries.sort((a, b) => a.name.localeCompare(b.name)).map(f => (
                  <button key={f.path} onClick={() => openFile(f)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      background: selectedFile?.path === f.path ? '#0d1b24' : 'none',
                      border: 'none',
                      borderLeft: selectedFile?.path === f.path ? '2px solid #00b4d8' : '2px solid transparent',
                      padding: '4px 12px 4px 18px',
                      cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--font-sm)',
                      color: selectedFile?.path === f.path ? '#e2e8f0' : '#94a3b8',
                    }}>
                    {extIcon(f.name)} {f.name}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* File content */}
          <div style={{ background: '#0c0e11', border: '1px solid #252b38', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 500 }}>
            {selectedFile ? (
              <>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid #252b38', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#13171e', flexShrink: 0 }}>
                  <div>
                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-base)', color: '#00b4d8' }}>{selectedFile.name}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-xs)', color: '#475569', marginLeft: 8 }}>{selectedFile.path}</span>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(fileContent)}
                    style={{ fontSize: 'var(--font-xs)', color: '#64748b', background: 'none', border: '1px solid #252b38', borderRadius: 3, padding: '2px 8px', cursor: 'pointer', fontFamily: 'monospace' }}>
                    Copy
                  </button>
                </div>
                <div style={{ overflow: 'auto', flex: 1, padding: '10px 0', fontFamily: 'JetBrains Mono, monospace', fontSize: 'var(--font-base)', lineHeight: 1.7 }}>
                  {fileLoading ? (
                    <div style={{ padding: 20, color: '#475569', fontFamily: 'monospace', fontSize: 'var(--font-base)' }}>読み込み中...</div>
                  ) : (
                    <HighlightedCode content={fileContent} ext={ext} />
                  )}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 8, color: '#2d3748' }}>
                <span style={{ fontSize: 28 }}>📂</span>
                <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-base)' }}>左のファイルを選択してください</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && !loading && logs.length === 0 && (
        <div style={{ background: '#1a1f29', border: '1px solid #252b38', borderRadius: 6, padding: 40, textAlign: 'center', color: '#475569' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🗄️</div>
          <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-md)', marginBottom: 8 }}>「ファイル一覧を取得」ボタンを押してください</div>
          <div style={{ fontSize: 'var(--font-sm)', color: '#334155', lineHeight: 1.8 }}>
            デフォルト値 (default/default/prod/default/default) で試行します<br />
            失敗した場合は environment / region を調整してください
          </div>
        </div>
      )}
    </div>
  )
}
