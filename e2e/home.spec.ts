import { test, expect } from '@playwright/test'

/**
 * /api/config と /api/vespa のレスポンスをモックするヘルパー
 */
async function mockApis(page: Parameters<Parameters<typeof test>[1]>[0]) {
  // 設定 API: 環境変数が未設定の場合を想定し空文字列を返す
  await page.route('/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ vespaUrl: '', feedUrl: '', configUrl: '' }),
    })
  })

  // Vespa API: ヘルスチェックを成功として返す
  await page.route('/api/vespa', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status: 200, data: { status: { code: 'up' } } }),
    })
  })
}

test.describe('メインページ', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
  })

  // ── ページロード ────────────────────────────────────────────
  test('ページが正常にロードされる', async ({ page }) => {
    await expect(page).toHaveTitle(/Vespa/i)
  })

  test('ヘッダーにVespa Adminロゴが表示される', async ({ page }) => {
    await expect(page.getByText('Vespa')).toBeVisible()
    await expect(page.getByText('Admin')).toBeVisible()
  })

  test('初期状態でSearchタブが選択されている', async ({ page }) => {
    await expect(page.getByText('▶ Execute Search')).toBeVisible()
  })

  // ── タブナビゲーション ──────────────────────────────────────
  test('Searchタブが表示されている', async ({ page }) => {
    await expect(page.getByRole('button', { name: '🔍 Search' })).toBeVisible()
  })

  test('Documentsタブが表示されている', async ({ page }) => {
    await expect(page.getByRole('button', { name: '📥 Documents' })).toBeVisible()
  })

  test('Query Traceタブが表示されている', async ({ page }) => {
    await expect(page.getByRole('button', { name: '🔬 Query Trace' })).toBeVisible()
  })

  test('Schema / Configタブが表示されている', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Schema/ })).toBeVisible()
  })

  test('Healthタブが表示されている', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Health/ })).toBeVisible()
  })

  test('Logsタブが表示されている', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Logs/ })).toBeVisible()
  })

  test('Documentsタブをクリックするとドキュメントパネルが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '📥 Documents' }).click()
    await expect(page.getByText('OPERATION')).toBeVisible()
  })

  test('Healthタブをクリックするとヘルスパネルが表示される', async ({ page }) => {
    await page.getByRole('button', { name: /Health/ }).click()
    await expect(page.getByText(/services UP/)).toBeVisible()
  })

  test('Logsタブをクリックするとログパネルが表示される', async ({ page }) => {
    await page.getByRole('button', { name: /Logs/ }).click()
    await expect(page.getByRole('button', { name: 'Parse Logs' })).toBeVisible()
  })

  test('Schema / Configタブをクリックするとスキーマパネルが表示される', async ({ page }) => {
    await page.getByRole('button', { name: /Schema/ }).click()
    await expect(page.getByText('APPLICATION PACKAGE')).toBeVisible()
  })

  test('Query Traceタブをクリックするとトレースパネルが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '🔬 Query Trace' }).click()
    await expect(page.getByRole('button', { name: /Analyze Query/ })).toBeVisible()
  })

  test('タブを切り替えて元に戻すと正しいパネルが表示される', async ({ page }) => {
    // Health タブへ切り替え
    await page.getByRole('button', { name: /Health/ }).click()
    await expect(page.getByText(/services UP/)).toBeVisible()

    // Search タブへ戻す
    await page.getByRole('button', { name: '🔍 Search' }).click()
    await expect(page.getByText('▶ Execute Search')).toBeVisible()
  })

  // ── 設定パネル ──────────────────────────────────────────────
  test('Settingsボタンをクリックすると設定パネルが表示される', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/ }).click()
    await expect(page.getByText('QUERY CONTAINER URL')).toBeVisible()
    await expect(page.getByText('FEED CONTAINER URL')).toBeVisible()
    await expect(page.getByText('CONFIG SERVER URL')).toBeVisible()
  })

  test('Settingsボタンを再クリックすると設定パネルが閉じる', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/ }).click()
    await expect(page.getByText('QUERY CONTAINER URL')).toBeVisible()

    await page.getByRole('button', { name: /Settings/ }).click()
    await expect(page.getByText('QUERY CONTAINER URL')).not.toBeVisible()
  })

  test('設定パネルでURLを変更できる', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/ }).click()

    const inputs = page.locator('input[type="text"]')
    const firstInput = inputs.first()
    await firstInput.clear()
    await firstInput.fill('http://custom-vespa:8081')
    await expect(firstInput).toHaveValue('http://custom-vespa:8081')
  })

  test('Reset defaultsボタンでURLがデフォルトに戻る', async ({ page }) => {
    await page.getByRole('button', { name: /Settings/ }).click()

    // URLを変更する
    const inputs = page.locator('input[type="text"]')
    const firstInput = inputs.first()
    await firstInput.clear()
    await firstInput.fill('http://custom-vespa:8081')

    // Reset defaults をクリック
    await page.getByRole('button', { name: /Reset defaults/ }).click()
    await expect(firstInput).toHaveValue('http://localhost:8081')
  })

  // ── フォントサイズ切り替え ────────────────────────────────────
  test('フォントサイズ切り替えボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: /文字サイズ/ })).toBeVisible()
  })

  test('フォントサイズ切り替えボタンをクリックすると大に変更される', async ({ page }) => {
    const fontBtn = page.getByRole('button', { name: /文字サイズ/ })
    await expect(fontBtn).toHaveAttribute('aria-pressed', 'false')
    await fontBtn.click()
    await expect(fontBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('フォントサイズを大にした後もう一度クリックすると中に戻る', async ({ page }) => {
    const fontBtn = page.getByRole('button', { name: /文字サイズ/ })
    await fontBtn.click()
    await expect(fontBtn).toHaveAttribute('aria-pressed', 'true')

    await fontBtn.click()
    await expect(fontBtn).toHaveAttribute('aria-pressed', 'false')
  })

  // ── ヘルスインジケーター ──────────────────────────────────────
  test('ヘルスインジケーターが表示される', async ({ page }) => {
    // Connected / Disconnected / Unknown のいずれかが表示される
    await expect(
      page.getByText(/Connected|Disconnected|Unknown/)
    ).toBeVisible()
  })

  test('Vespaが応答するとConnectedが表示される', async ({ page }) => {
    await expect(page.getByText('Connected')).toBeVisible()
  })
})
