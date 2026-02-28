import { test, expect } from '@playwright/test'

/**
 * ヘルスパネル用のAPIモック設定
 */
async function mockHealthApis(
  page: Parameters<Parameters<typeof test>[1]>[0],
  options: { healthy?: boolean } = { healthy: true }
) {
  await page.route('/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ vespaUrl: '', feedUrl: '', configUrl: '' }),
    })
  })

  const healthy = options.healthy !== false

  await page.route('/api/vespa', async (route) => {
    if (healthy) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          status: 200,
          data: { status: { code: 'up' } },
        }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          status: 0,
          error: 'connection refused',
        }),
      })
    }
  })
}

test.describe('ヘルスパネル', () => {
  test.beforeEach(async ({ page }) => {
    await mockHealthApis(page, { healthy: true })
    await page.goto('/')
    await page.getByRole('button', { name: /Health/ }).click()
  })

  // ── 表示確認 ─────────────────────────────────────────────────
  test('ヘルスパネルが表示される', async ({ page }) => {
    await expect(page.getByText(/services UP/)).toBeVisible()
  })

  test('サービス一覧が表示される', async ({ page }) => {
    await expect(page.getByText('Container (Query)')).toBeVisible()
    await expect(page.getByText('Config Server')).toBeVisible()
  })

  test('Refreshボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '↻ Refresh' })).toBeVisible()
  })

  // ── 正常時の表示 ─────────────────────────────────────────────
  test('全サービスが正常の場合UPバッジが表示される', async ({ page }) => {
    await expect(page.getByText('UP').first()).toBeVisible()
  })

  test('全サービスが正常の場合 "4/4 services UP" が表示される', async ({ page }) => {
    await expect(page.getByText('4/4 services UP')).toBeVisible()
  })

  // ── ダウン時の表示 ────────────────────────────────────────────
  test('サービスが停止している場合DOWNバッジが表示される', async ({ page }) => {
    await mockHealthApis(page, { healthy: false })
    await page.reload()
    await page.getByRole('button', { name: /Health/ }).click()

    await expect(page.getByText('DOWN').first()).toBeVisible()
  })

  test('全サービスが停止している場合 "0/4 services UP" が表示される', async ({ page }) => {
    await mockHealthApis(page, { healthy: false })
    await page.reload()
    await page.getByRole('button', { name: /Health/ }).click()

    await expect(page.getByText('0/4 services UP')).toBeVisible()
  })

  // ── Refreshボタン ─────────────────────────────────────────────
  test('Refreshボタンをクリックすると再フェッチが走る', async ({ page }) => {
    // まず完了を待つ
    await expect(page.getByRole('button', { name: '↻ Refresh' })).toBeVisible()

    let requestCount = 0
    page.on('request', (req) => {
      if (req.url().includes('/api/vespa') && req.method() === 'POST') {
        requestCount++
      }
    })

    await page.getByRole('button', { name: '↻ Refresh' }).click()

    // Refresh 後に追加でリクエストが発行される
    await expect(page.getByRole('button', { name: '↻ Refresh' })).toBeVisible()
    expect(requestCount).toBeGreaterThan(0)
  })
})
