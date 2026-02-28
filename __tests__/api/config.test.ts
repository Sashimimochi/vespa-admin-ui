/**
 * @jest-environment node
 */
import { GET } from '@/app/api/config/route'

describe('GET /api/config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('環境変数が設定されている場合、その値を返す', async () => {
    process.env.VESPA_URL = 'http://host.docker.internal:8081'
    process.env.FEED_URL = 'http://host.docker.internal:8080'
    process.env.CONFIG_URL = 'http://host.docker.internal:19071'

    const res = await GET()
    const json = await res.json()

    expect(json.vespaUrl).toBe('http://host.docker.internal:8081')
    expect(json.feedUrl).toBe('http://host.docker.internal:8080')
    expect(json.configUrl).toBe('http://host.docker.internal:19071')
  })

  it('環境変数が未設定の場合、空文字列を返す', async () => {
    delete process.env.VESPA_URL
    delete process.env.FEED_URL
    delete process.env.CONFIG_URL

    const res = await GET()
    const json = await res.json()

    expect(json.vespaUrl).toBe('')
    expect(json.feedUrl).toBe('')
    expect(json.configUrl).toBe('')
  })

  it('一部の環境変数のみ設定されている場合、設定済みの値と空文字列を返す', async () => {
    delete process.env.VESPA_URL
    process.env.FEED_URL = 'http://host.docker.internal:8080'
    delete process.env.CONFIG_URL

    const res = await GET()
    const json = await res.json()

    expect(json.vespaUrl).toBe('')
    expect(json.feedUrl).toBe('http://host.docker.internal:8080')
    expect(json.configUrl).toBe('')
  })

  it('レスポンスにvespaUrl、feedUrl、configUrlのキーが含まれる', async () => {
    const res = await GET()
    const json = await res.json()

    expect(json).toHaveProperty('vespaUrl')
    expect(json).toHaveProperty('feedUrl')
    expect(json).toHaveProperty('configUrl')
  })
})
