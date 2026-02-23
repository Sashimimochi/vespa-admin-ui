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
})
