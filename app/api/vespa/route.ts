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

  const { requestBody } = body

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

    if (requestBody !== undefined && (method === 'PUT' || method === 'POST' || method === 'DELETE')) {
      let bodyPayload: unknown = requestBody
      if (typeof bodyPayload === 'string') {
        try {
          bodyPayload = JSON.parse(bodyPayload)
        } catch {
          // パース不可な生文字列はそのまま使用
        }
      }
      const bodyStr = JSON.stringify(bodyPayload)
      // Node.js native fetch (undici) は string body を Transfer-Encoding: chunked で送ることがあり、
      // Vespa Document API が chunked encoding を正しくパースできずに VALUE_STRING エラーになる。
      // Buffer + Content-Length を明示することで chunked を回避する。
      const bodyBuf = Buffer.from(bodyStr, 'utf8')
      console.log(`[api/vespa] → ${method} ${url}`)
      console.log(`[api/vespa]   body(${bodyBuf.length}B): ${bodyStr}`)
      fetchOptions.headers = {
        'Content-Type': 'application/json',
        'Content-Length': String(bodyBuf.length),
      }
      fetchOptions.body = bodyBuf as unknown as BodyInit
    }

    const res = await fetch(url, { ...fetchOptions, signal: AbortSignal.timeout(30000) })

    let data: unknown
    const text = await res.text()
    if (method === 'PUT' || method === 'POST' || method === 'DELETE') {
      console.log(`[api/vespa] ← HTTP ${res.status} ${text.slice(0, 300)}`)
    }
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    // HTTP 200 を返すのは意図的な設計。
    // クライアントはレスポンスボディの ok / status フィールドでエラーを判定するため、
    // ネットワークエラー・タイムアウト等の例外も含めて常に 200 で包んで返している。
    return NextResponse.json({ ok: false, status: 0, error: msg }, { status: 200 })
  }
}
