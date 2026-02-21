import { NextRequest, NextResponse } from 'next/server'

// Proxy any request to Vespa endpoints
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { endpoint, method = 'GET', params, vespaUrl = 'http://localhost:8080', configUrl = 'http://localhost:19071' } = body

  try {
    let url = ''
    let fetchOptions: RequestInit = { method }

    if (endpoint.startsWith('/application') || endpoint.startsWith('/log')) {
      url = `${configUrl}${endpoint}`
    } else {
      url = `${vespaUrl}${endpoint}`
    }

    if (params && method === 'GET') {
      const qs = new URLSearchParams(params).toString()
      url = `${url}${qs ? '?' + qs : ''}`
    }

    if (params && method === 'POST') {
      fetchOptions.headers = { 'Content-Type': 'application/json' }
      fetchOptions.body = JSON.stringify(params)
    }

    const res = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(30000) })
    const contentType = res.headers.get('content-type') || ''

    let data
    if (contentType.includes('json')) {
      data = await res.json()
    } else {
      data = await res.text()
    }

    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
