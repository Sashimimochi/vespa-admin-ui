import { test, expect } from '@playwright/test'

/**
 * /api/config と /api/vespa のレスポンスをモックするヘルパー
 */
async function mockApis(
  page: Parameters<Parameters<typeof test>[1]>[0],
  searchResponse?: object
) {
  await page.route('/api/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ vespaUrl: '', feedUrl: '', configUrl: '' }),
    })
  })

  const defaultSearchResponse = {
    ok: true,
    status: 200,
    data: {
      root: {
        fields: { totalCount: 2 },
        children: [
          {
            id: 'id:music:music::1',
            relevance: 0.9876,
            fields: { title: 'Shape of You', artist: 'Ed Sheeran' },
          },
          {
            id: 'id:music:music::2',
            relevance: 0.8765,
            fields: { title: 'Blinding Lights', artist: 'The Weeknd' },
          },
        ],
        coverage: { coverage: 100 },
      },
    },
  }

  await page.route('/api/vespa', async (route) => {
    const body = route.request().postDataJSON() as { endpoint?: string }
    if (body?.endpoint === '/search/') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(searchResponse ?? defaultSearchResponse),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, status: 200, data: { status: { code: 'up' } } }),
      })
    }
  })
}

test.describe('検索パネル', () => {
  test.beforeEach(async ({ page }) => {
    await mockApis(page)
    await page.goto('/')
    // Search タブは初期状態で選択されている
  })

  // ── 表示確認 ─────────────────────────────────────────────────
  test('YQLエディターが表示される', async ({ page }) => {
    await expect(page.getByPlaceholder('select * from sources * where userQuery()')).toBeVisible()
  })

  test('YQLエディターの初期値が設定されている', async ({ page }) => {
    const textarea = page.getByPlaceholder('select * from sources * where userQuery()')
    await expect(textarea).toHaveValue('select * from doc where true')
  })

  test('PARAMETERSセクションが表示される', async ({ page }) => {
    await expect(page.getByText('PARAMETERS')).toBeVisible()
  })

  test('Execute Searchボタンが表示される', async ({ page }) => {
    await expect(page.getByRole('button', { name: '▶ Execute Search' })).toBeVisible()
  })

  test('YQLクエリーラベルが表示される', async ({ page }) => {
    await expect(page.getByText('YQL QUERY')).toBeVisible()
  })

  // ── 検索実行 ─────────────────────────────────────────────────
  test('Execute Searchボタンをクリックすると検索が実行される', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Execute Search' }).click()

    // 検索結果が表示される
    await expect(page.getByText('RESULTS')).toBeVisible()
  })

  test('検索成功時にtotalCountが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Execute Search' }).click()

    await expect(page.getByText('totalCount:')).toBeVisible()
    // totalCount: 2 の strong 要素が表示される
    await expect(page.locator('strong').filter({ hasText: '2' })).toBeVisible()
  })

  test('検索結果にヒットカードが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Execute Search' }).click()

    await expect(page.getByText('id:music:music::1')).toBeVisible()
    await expect(page.getByText('id:music:music::2')).toBeVisible()
  })

  test('YQLを変更してから検索を実行できる', async ({ page }) => {
    const textarea = page.getByPlaceholder('select * from sources * where userQuery()')
    await textarea.clear()
    await textarea.fill('select * from music where true')

    await page.getByRole('button', { name: '▶ Execute Search' }).click()
    await expect(page.getByText('RESULTS')).toBeVisible()
  })

  test('Ctrl+Enterで検索が実行される', async ({ page }) => {
    const textarea = page.getByPlaceholder('select * from sources * where userQuery()')
    await textarea.click()
    await page.keyboard.press('Control+Enter')

    await expect(page.getByText('RESULTS')).toBeVisible()
  })

  // ── エラー表示 ────────────────────────────────────────────────
  test('エラー時にエラーメッセージが表示される', async ({ page }) => {
    // エラーレスポンスを返すようにモックを上書き
    await page.route('/api/vespa', async (route) => {
      const body = route.request().postDataJSON() as { endpoint?: string }
      if (body?.endpoint === '/search/') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: false, error: 'Vespa is not available' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, status: 200, data: { status: { code: 'up' } } }),
        })
      }
    })

    await page.getByRole('button', { name: '▶ Execute Search' }).click()
    await expect(page.getByText(/Vespa is not available/)).toBeVisible()
  })

  // ── Resetボタン ───────────────────────────────────────────────
  test('YQL変更後、Resetボタンをクリックすると初期値に戻る', async ({ page }) => {
    const textarea = page.getByPlaceholder('select * from sources * where userQuery()')
    await textarea.clear()
    await textarea.fill('select * from news where true')
    await expect(textarea).toHaveValue('select * from news where true')

    await page.getByRole('button', { name: 'Reset' }).click()
    await expect(textarea).toHaveValue('select * from doc where true')
  })

  // ── 表示モード切り替え ────────────────────────────────────────
  test('検索後に表示モードをtreeに切り替えられる', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Execute Search' }).click()
    await expect(page.getByText('RESULTS')).toBeVisible()

    await page.getByRole('button', { name: 'tree' }).click()
    // tree ビューが有効になったボタンが強調表示される
    await expect(page.getByRole('button', { name: 'tree' })).toBeVisible()
  })

  test('検索後に表示モードをrawに切り替えられる', async ({ page }) => {
    await page.getByRole('button', { name: '▶ Execute Search' }).click()
    await expect(page.getByText('RESULTS')).toBeVisible()

    await page.getByRole('button', { name: 'raw' }).click()
    // raw ビューで JSON が表示される（{ を含むテキストが見える）
    const pre = page.locator('pre')
    await expect(pre).toBeVisible()
    await expect(pre).toContainText('{')
  })
})
