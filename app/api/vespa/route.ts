import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    endpoint,
    method = 'GET',
    params,
    vespaUrl = 'http://localhost:8080',
    configUrl = 'http://localhost:19071',
  } = body

  try {
    // Config Server へのルーティング判定
    const isConfigEndpoint =
      endpoint.startsWith('/application') ||
      endpoint.startsWith('/config/') ||
      endpoint.startsWith('/log') ||
      endpoint.startsWith('/orchestrator')

    const baseUrl = isConfigEndpoint ? configUrl : vespaUrl
    let url = `${baseUrl}${endpoint}`

    const fetchOptions: RequestInit = { method }

    if (params && method === 'GET') {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
      if (qs) url = `${url}${url.includes('?') ? '&' : '?'}${qs}`
    }

    if (params && method === 'POST') {
      fetchOptions.headers = { 'Content-Type': 'application/json' }
      fetchOptions.body = JSON.stringify(params)
    }

    const res = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(30000) })
    const contentType = res.headers.get('content-type') || ''

    let data: unknown
    const text = await res.text()
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, status: 0, error: msg }, { status: 200 })
  }
}
