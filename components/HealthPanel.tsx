'use client'
import { useState, useEffect, useCallback } from 'react'

interface HealthPanelProps { vespaUrl: string; configUrl: string }

interface ServiceHealth {
  name: string
  url: string
  status: 'up' | 'down' | 'unknown' | 'loading'
  message?: string
  version?: string
  generation?: number
}

interface TopologyNode {
  hostname: string
  fullHostname: string
  status: 'up' | 'down' | 'unknown'
  services: string[]
}

interface ParsedCluster {
  type: 'admin' | 'container' | 'content'
  name: string
  nodes: TopologyNode[]
}

export function extractClusterName(configId: string, role: string, type: string): string {
  if (configId) {
    const parts = configId.split('/')
    if (parts.length >= 2) return parts[1]
  }
  if (role) {
    const parts = role.split('/')
    if (parts[0] === type && parts.length >= 2) return parts[1]
    if (parts.length >= 2) return parts[1]
  }
  return 'default'
}

export function parseClusterTopology(metrics: unknown): ParsedCluster[] {
  if (!metrics || typeof metrics !== 'object') return []
  const nodes = (metrics as Record<string, unknown>).nodes
  if (!Array.isArray(nodes) || nodes.length === 0) return []

  const clusterMap = new Map<string, ParsedCluster>()

  for (const nodeData of nodes) {
    const n = nodeData as Record<string, unknown>
    const fullHostname = String(n.hostname || 'unknown')
    const shortHostname = fullHostname.split('.')[0]
    const role = String(n.role || '')
    const services = Array.isArray(n.services) ? n.services : []

    let nodeStatus: 'up' | 'down' | 'unknown' = 'unknown'
    const serviceNames: string[] = []
    let detectedType: 'admin' | 'container' | 'content' | null = null
    let detectedClusterName = 'default'

    for (const svcData of services) {
      const svc = svcData as Record<string, unknown>
      const svcName = String(svc.name || '')
      if (svcName) serviceNames.push(svcName)

      const statusCode = String((svc.status as Record<string, unknown> | undefined)?.code ?? '')
      if (statusCode === 'up' && nodeStatus === 'unknown') nodeStatus = 'up'
      else if (statusCode && statusCode !== 'up') nodeStatus = 'down'

      const clusterType = String(svc.clusterType || '')
      const clusterName = String(svc.clusterName || '')
      const configId = String(svc.configId || svc.config_id || '')

      if (!detectedType) {
        if (clusterType === 'admin' || svcName.includes('configserver') || svcName.includes('slobrok') || svcName.includes('logserver')) {
          detectedType = 'admin'
          detectedClusterName = 'admin/config'
        } else if (clusterType === 'container' || svcName === 'vespa.container') {
          detectedType = 'container'
          detectedClusterName = clusterName || extractClusterName(configId, role, 'container') || 'default'
        } else if (clusterType === 'content' || svcName.includes('searchnode') || svcName.includes('distributor') || svcName.includes('storagenode')) {
          detectedType = 'content'
          detectedClusterName = clusterName || extractClusterName(configId, role, 'content') || 'default'
        } else if (svcName.includes('clustercontroller')) {
          detectedType = 'admin'
          detectedClusterName = 'admin/config'
        }
      }
    }

    if (!detectedType && role) {
      if (role.startsWith('container/') || role.includes('/container/')) {
        detectedType = 'container'
        detectedClusterName = role.split('/')[1] || 'default'
      } else if (role.startsWith('content/') || role.startsWith('distributor/') || role.startsWith('searchnode/')) {
        detectedType = 'content'
        detectedClusterName = role.split('/')[1] || 'default'
      } else if (role.startsWith('admin') || role.startsWith('hosts/')) {
        detectedType = 'admin'
        detectedClusterName = 'admin/config'
      }
    }

    if (detectedType) {
      const key = `${detectedType}:${detectedClusterName}`
      if (!clusterMap.has(key)) {
        clusterMap.set(key, { type: detectedType, name: detectedClusterName, nodes: [] })
      }
      clusterMap.get(key)!.nodes.push({ hostname: shortHostname, fullHostname, status: nodeStatus, services: serviceNames })
    }
  }

  return Array.from(clusterMap.values())
}

function NodeIcon({ node }: { node: TopologyNode }) {
  const [hovered, setHovered] = useState(false)
  const color = node.status === 'up' ? '#22c55e' : node.status === 'down' ? '#ef4444' : '#64748b'
  return (
    <div
      style={{ textAlign: 'center', cursor: 'default', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: 40, height: 40, background: '#1e293b', border: `2px solid ${color}40`, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', margin: '0 auto' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2" y="2" width="16" height="6" rx="1.5" stroke={color} strokeWidth="1.3" />
          <rect x="2" y="11" width="16" height="6" rx="1.5" stroke={color} strokeWidth="1.3" />
          <circle cx="15" cy="5" r="1.2" fill={color} />
          <circle cx="15" cy="14" r="1.2" fill={color} />
        </svg>
        <div style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: color, border: '2px solid #0f1117' }} />
      </div>
      <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#64748b', marginTop: 3, maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {node.hostname}
      </div>
      {hovered && (
        <div
          data-testid="node-tooltip"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 'var(--font-xs)',
            fontFamily: 'monospace',
            color: '#e2e8f0',
            whiteSpace: 'normal',
            maxWidth: 'min(360px, 80vw)',
            overflowWrap: 'break-word',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {node.fullHostname}
        </div>
      )}
    </div>
  )
}

function ClusterBox({ cluster }: { cluster: ParsedCluster }) {
  const cfg = {
    admin: { color: '#a855f7', bg: '#a855f710', border: '#a855f730', label: 'admin / config cluster' },
    container: { color: '#3b82f6', bg: '#3b82f610', border: '#3b82f630', label: 'container cluster' },
    content: { color: '#f59e0b', bg: '#f59e0b10', border: '#f59e0b30', label: 'content cluster' },
  }[cluster.type]
  const upCount = cluster.nodes.filter(n => n.status === 'up').length
  const displayName = cluster.name !== 'default' && cluster.name !== 'admin/config' ? cluster.name : ''

  return (
    <div style={{ border: `1.5px solid ${cfg.border}`, background: cfg.bg, borderRadius: 8, padding: '10px 14px', minWidth: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ color: cfg.color, fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em' }}>
          {displayName ? `${displayName} · ` : ''}{cfg.label}
        </span>
        <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: 10, marginLeft: 8, flexShrink: 0 }}>
          {upCount}/{cluster.nodes.length} UP
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {cluster.nodes.map((node) => <NodeIcon key={node.fullHostname} node={node} />)}
      </div>
    </div>
  )
}

function ClusterTopologyView({ metrics }: { metrics: unknown }) {
  const clusters = parseClusterTopology(metrics)
  if (clusters.length === 0) return null

  const adminClusters = clusters.filter(c => c.type === 'admin')
  const containerClusters = clusters.filter(c => c.type === 'container')
  const contentClusters = clusters.filter(c => c.type === 'content')

  return (
    <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
      <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 14 }}>
        CLUSTER TOPOLOGY
      </div>
      <div style={{ border: '1.5px solid var(--vespa-border)', borderRadius: 8, padding: 16, background: 'var(--vespa-bg)', position: 'relative' }}>
        <span style={{ position: 'absolute', top: -9, left: 14, background: 'var(--vespa-bg)', padding: '0 6px', fontSize: 10, fontFamily: 'monospace', color: '#64748b', fontWeight: 700, letterSpacing: '0.08em' }}>
          VESPA CLUSTER
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {adminClusters.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {adminClusters.map((c) => <ClusterBox key={`${c.type}:${c.name}`} cluster={c} />)}
            </div>
          )}
          {(containerClusters.length > 0 || contentClusters.length > 0) && (
            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {containerClusters.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {containerClusters.map((c) => <ClusterBox key={`${c.type}:${c.name}`} cluster={c} />)}
                </div>
              )}
              {contentClusters.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {contentClusters.map((c) => <ClusterBox key={`${c.type}:${c.name}`} cluster={c} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const BASE_SERVICES = (vespaUrl: string, configUrl: string): ServiceHealth[] => [
  { name: 'Container (Query)', url: `${vespaUrl}/state/v1/health`, status: 'unknown' },
  { name: 'Config Server', url: `${configUrl}/state/v1/health`, status: 'unknown' },
  { name: 'Application Status', url: `${vespaUrl}/ApplicationStatus`, status: 'unknown' },
  { name: 'Metrics API', url: `${vespaUrl}/metrics/v2/values`, status: 'unknown' },
]

function StatusBadge({ status }: { status: ServiceHealth['status'] }) {
  const color = { up: '#22c55e', down: '#ef4444', unknown: '#64748b', loading: '#f59e0b' }[status]
  const label = { up: 'UP', down: 'DOWN', unknown: '—', loading: '...' }[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className={status === 'loading' ? 'pulse-dot' : ''} style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ color, fontFamily: 'monospace', fontSize: 'var(--font-sm)', fontWeight: 700 }}>{label}</span>
    </span>
  )
}

export default function HealthPanel({ vespaUrl, configUrl }: HealthPanelProps) {
  const [services, setServices] = useState<ServiceHealth[]>(BASE_SERVICES(vespaUrl, configUrl).map(s => ({ ...s, status: 'loading' })))
  const [appStatus, setAppStatus] = useState<unknown>(null)
  const [metrics, setMetrics] = useState<unknown>(null)
  const [clusterStatus, setClusterStatus] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)

  const checkHealth = useCallback(async () => {
    setLoading(true)
    const base = BASE_SERVICES(vespaUrl, configUrl)
    const updated = await Promise.all(base.map(async (svc) => {
      try {
        // Extract endpoint from full URL
        const urlObj = new URL(svc.url)
        const endpoint = urlObj.pathname
        const isConfig = urlObj.port === '19071' || svc.url.includes(configUrl)
        const res = await fetch('/api/vespa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint, method: 'GET', vespaUrl, configUrl })
        })
        const json = await res.json()
        const data = json.data

        // Store app status and metrics separately
        if (endpoint === '/ApplicationStatus') setAppStatus(data)
        if (endpoint === '/metrics/v2/values') setMetrics(data)

        const statusCode = data?.status?.code || (json.ok ? 'up' : 'down')
        return {
          ...svc,
          status: (statusCode === 'up' || json.ok) ? 'up' as const : 'down' as const,
          message: data?.status?.message || '',
          version: data?.version,
        }
      } catch {
        return { ...svc, status: 'down' as const, message: 'Connection refused' }
      }
    }))
    setServices(updated)

    // Try cluster controller
    try {
      const res = await fetch('/api/vespa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/clustercontroller-status/v1/', method: 'GET', vespaUrl, configUrl })
      })
      const json = await res.json()
      if (json.ok) setClusterStatus(json.data)
    } catch { /* optional */ }

    setLoading(false)
  }, [vespaUrl, configUrl])

  useEffect(() => { checkHealth() }, [checkHealth])

  const upCount = services.filter(s => s.status === 'up').length

  return (
    <div className="slide-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-base)', color: '#64748b' }}>
            {upCount}/{services.length} services UP
          </span>
        </div>
        <button onClick={checkHealth} disabled={loading}
          style={{ background: 'none', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: '5px 14px', color: loading ? '#64748b' : '#e2e8f0', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 'var(--font-base)', fontFamily: 'monospace' }}>
          {loading ? '⟳ Checking...' : '↻ Refresh'}
        </button>
      </div>

      {/* Service Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
        {services.map(svc => (
          <div key={svc.name} style={{ background: 'var(--vespa-panel)', border: `1px solid ${svc.status === 'up' ? '#22c55e30' : svc.status === 'down' ? '#ef444430' : 'var(--vespa-border)'}`, borderRadius: 6, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 500, fontSize: 'var(--font-md)' }}>{svc.name}</span>
              <StatusBadge status={svc.status} />
            </div>
            <div style={{ fontSize: 'var(--font-xs)', color: '#64748b', fontFamily: 'monospace' }}>{svc.url.replace(vespaUrl, 'container').replace(configUrl, 'configserver')}</div>
            {svc.message && <div style={{ fontSize: 'var(--font-sm)', color: '#a8d8ea', marginTop: 4 }}>{svc.message}</div>}
            {svc.version && <div style={{ fontSize: 'var(--font-xs)', color: '#64748b', marginTop: 2, fontFamily: 'monospace' }}>v{svc.version}</div>}
          </div>
        ))}
      </div>

      {/* Cluster Topology */}
      <ClusterTopologyView metrics={metrics} />

      {/* App Status - Search Chains */}
      {appStatus && typeof appStatus === 'object' && (
        <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
          <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-base)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 12 }}>APPLICATION STATUS</div>
          <AppStatusView data={appStatus} />
        </div>
      )}

      {/* Cluster status */}
      {clusterStatus && (
        <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
          <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-base)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>CLUSTER CONTROLLER</div>
          <pre style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', color: '#a8d8ea', overflow: 'auto', maxHeight: 300, margin: 0 }}>
            {typeof clusterStatus === 'string' ? clusterStatus : JSON.stringify(clusterStatus, null, 2)}
          </pre>
        </div>
      )}

      {/* Metrics summary */}
      {metrics && typeof metrics === 'object' && 'nodes' in (metrics as object) && (
        <div style={{ background: 'var(--vespa-panel)', border: '1px solid var(--vespa-border)', borderRadius: 6, padding: 16 }}>
          <div style={{ color: '#818cf8', fontFamily: 'monospace', fontSize: 'var(--font-base)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 12 }}>METRICS NODES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {((metrics as Record<string, unknown>).nodes as unknown[]).map((node: unknown, i: number) => {
              const n = node as Record<string, unknown>
              return (
                <div key={i} style={{ background: 'var(--vespa-bg)', border: '1px solid var(--vespa-border)', borderRadius: 4, padding: 10 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', color: '#e2e8f0', marginBottom: 4 }}>
                    {String(n.hostname || 'node-' + i)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {n.role && <span style={{ fontSize: 'var(--font-xs)', color: '#818cf8', fontFamily: 'monospace' }}>{String(n.role)}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function AppStatusView({ data }: { data: unknown }) {
  const d = data as Record<string, unknown>
  const container = d?.container as Record<string, unknown> | undefined
  const chains = container?.['searcher-chains'] as Record<string, unknown> | undefined

  if (!chains) {
    return <pre style={{ fontFamily: 'monospace', fontSize: 'var(--font-sm)', color: '#a8d8ea', overflow: 'auto', maxHeight: 300, margin: 0 }}>{JSON.stringify(data, null, 2)}</pre>
  }

  return (
    <div>
      {Object.entries(chains).map(([name, chain]) => (
        <div key={name} style={{ marginBottom: 12, padding: 10, background: 'var(--vespa-bg)', borderRadius: 4, border: '1px solid var(--vespa-border)' }}>
          <div style={{ fontFamily: 'monospace', fontSize: 'var(--font-base)', color: '#00b4d8', marginBottom: 6 }}>Chain: {name}</div>
          {Array.isArray((chain as Record<string, unknown>)?.searchers) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {((chain as Record<string, unknown>).searchers as unknown[]).map((s: unknown, i: number) => (
                <div key={i} style={{ fontSize: 'var(--font-sm)', fontFamily: 'monospace', color: '#64748b', paddingLeft: 8, borderLeft: '2px solid var(--vespa-border)' }}>
                  {String((s as Record<string, unknown>)?.id || s)}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
