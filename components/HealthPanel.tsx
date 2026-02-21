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
