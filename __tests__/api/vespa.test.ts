/**
 * @jest-environment node
 */
import { POST } from '@/app/api/vespa/route'
import { NextRequest } from 'next/server'

const VESPA_URL = 'http://vespa:8081'
const CONFIG_URL = 'http://config:19071'

function makeRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/vespa', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/vespa', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('GETリクエストを正しくVespaに転送する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: { code: 'up' } }),
    })

    const req = makeRequest({
      endpoint: '/state/v1/health',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    const res = await POST(req)
    const json = await res.json()

    expect(global.fetch).toHaveBeenCalledWith(
      `${VESPA_URL}/state/v1/health`,
      expect.objectContaining({ method: 'GET' })
    )
    expect(json.ok).toBe(true)
    expect(json.status).toBe(200)
  })

  it('configエンドポイントはconfigUrlに転送する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/application/v2/tenant',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      `${CONFIG_URL}/application/v2/tenant`,
      expect.any(Object)
    )
  })

  it('/logエンドポイントはconfigUrlに転送する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/logs',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      `${CONFIG_URL}/logs`,
      expect.any(Object)
    )
  })

  it('GETリクエストにクエリパラメーターを付与する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/search/',
      method: 'GET',
      params: { yql: 'select * from doc where true', hits: '10' },
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string
    expect(calledUrl).toContain('yql=select+')
    expect(calledUrl).toContain('hits=10')
  })

  it('ネットワークエラー時はok:falseを返す', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Connection refused'))

    const req = makeRequest({
      endpoint: '/state/v1/health',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    const res = await POST(req)
    const json = await res.json()

    expect(json.ok).toBe(false)
    expect(json.error).toBe('Connection refused')
  })

  it('Vespaがエラーレスポンスを返した場合はok:falseを返す', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: 'Not found' }),
    })

    const req = makeRequest({
      endpoint: '/search/',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    const res = await POST(req)
    const json = await res.json()

    expect(json.ok).toBe(false)
    expect(json.status).toBe(404)
  })

  it('デフォルトのVespaURLとconfigURLを使用する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/state/v1/health',
      method: 'GET',
    })

    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8080/state/v1/health',
      expect.any(Object)
    )
  })

  // ── configUrl ルーティング ──────────────────────────────────────────────

  it('/config/プレフィックスはconfigUrlに転送する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/config/v1/tenant',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      `${CONFIG_URL}/config/v1/tenant`,
      expect.any(Object)
    )
  })

  it('/orchestratorエンドポイントはconfigUrlに転送する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/orchestrator/v1/hosts',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    expect(global.fetch).toHaveBeenCalledWith(
      `${CONFIG_URL}/orchestrator/v1/hosts`,
      expect.any(Object)
    )
  })

  // ── requestBody (PUT/POST/DELETE) ─────────────────────────────────────────

  it('PUTリクエストでrequestBodyを送るときContent-LengthをBufferで明示する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ pathId: 'doc1' }),
    })

    const payload = { fields: { title: { assign: 'Hello' } } }
    const req = makeRequest({
      endpoint: '/document/v1/ns/doc/docid/1',
      method: 'PUT',
      requestBody: payload,
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const [calledUrl, calledOpts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    const expectedBody = JSON.stringify(payload)
    const expectedLen = Buffer.from(expectedBody, 'utf8').length

    expect(calledUrl).toBe(`${VESPA_URL}/document/v1/ns/doc/docid/1`)
    expect((calledOpts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect((calledOpts.headers as Record<string, string>)['Content-Length']).toBe(String(expectedLen))
    // body は Buffer (Uint8Array のサブクラス) として渡される
    expect(calledOpts.body).toBeInstanceOf(Buffer)
    expect((calledOpts.body as Buffer).toString('utf8')).toBe(expectedBody)
  })

  it('DELETEリクエストでrequestBodyを送るときContent-LengthをBufferで明示する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const payload = { condition: 'true' }
    const req = makeRequest({
      endpoint: '/document/v1/ns/doc/docid/1',
      method: 'DELETE',
      requestBody: payload,
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const [, calledOpts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    const expectedLen = Buffer.from(JSON.stringify(payload), 'utf8').length

    expect((calledOpts.headers as Record<string, string>)['Content-Length']).toBe(String(expectedLen))
    expect(calledOpts.body).toBeInstanceOf(Buffer)
  })

  it('requestBodyが文字列の場合はJSONパースしてからBufferに変換する', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const payload = { fields: { title: 'str-body' } }
    const req = makeRequest({
      endpoint: '/document/v1/ns/doc/docid/2',
      method: 'PUT',
      requestBody: JSON.stringify(payload),   // 文字列として渡す
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const [, calledOpts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    // パース→再シリアライズされた文字列になる
    expect((calledOpts.body as Buffer).toString('utf8')).toBe(JSON.stringify(payload))
  })

  it('requestBodyが不正なJSON文字列の場合は生文字列をそのままBufferにする', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const rawStr = 'not-json'
    const req = makeRequest({
      endpoint: '/document/v1/ns/doc/docid/3',
      method: 'PUT',
      requestBody: rawStr,
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const [, calledOpts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    // JSON.parse 失敗 → rawStr のまま JSON.stringify される → "not-json"
    expect((calledOpts.body as Buffer).toString('utf8')).toBe(JSON.stringify(rawStr))
  })

  it('POSTリクエストでparamsを送るとJSONボディになる', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const params = { yql: 'select * from doc where true', hits: '5' }
    const req = makeRequest({
      endpoint: '/search/',
      method: 'POST',
      params,
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const [, calledOpts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    expect((calledOpts.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(calledOpts.body).toBe(JSON.stringify(params))
  })

  // ── レスポンス変換 ────────────────────────────────────────────────────────

  it('レスポンスボディがJSON以外のテキストのときdataに生文字列が入る', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'plain text response',
    })

    const req = makeRequest({
      endpoint: '/state/v1/health',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    const res = await POST(req)
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.data).toBe('plain text response')
  })

  // ── AbortSignal ───────────────────────────────────────────────────────────

  it('fetchにAbortSignalが渡される', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{}',
    })

    const req = makeRequest({
      endpoint: '/state/v1/health',
      method: 'GET',
      vespaUrl: VESPA_URL,
      configUrl: CONFIG_URL,
    })

    await POST(req)

    const [, calledOpts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    expect(calledOpts.signal).toBeDefined()
    expect(calledOpts.signal).toBeInstanceOf(AbortSignal)
  })
})
