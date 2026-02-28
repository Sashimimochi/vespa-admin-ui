import puppeteer, { Browser, Page } from 'puppeteer'

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3001'

/** nav タブを位置（1 始まり）で指定してクリックするヘルパー */
const NAV_TAB_INDEX: Record<string, number> = {
  Search: 1,
  Documents: 2,
  Trace: 3,
  Schema: 4,
  Health: 5,
  Logs: 6,
}

async function clickNavTab(page: Page, label: string): Promise<void> {
  const idx = NAV_TAB_INDEX[label]
  if (!idx) throw new Error(`Unknown tab label: "${label}"`)
  await page.click(`nav button:nth-child(${idx})`)
}

describe('Vespa Admin UI E2Eテスト', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  })

  afterAll(async () => {
    await browser.close()
  })

  beforeEach(async () => {
    page = await browser.newPage()
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
    // ヘルスインジケーターが Connected/Disconnected になるまで待機する。
    // これにより React のハイドレーションと初回 API コールの完了が保証される。
    await page.waitForFunction(
      () => {
        const spans = Array.from(document.querySelectorAll('header span'))
        return spans.some(
          s => s.textContent?.trim() === 'Disconnected' || s.textContent?.trim() === 'Connected'
        )
      },
      { timeout: 20000 }
    )
  })

  afterEach(async () => {
    await page.close()
  })

  // ── ページ読み込みテスト ─────────────────────────────────────────

  describe('ページ読み込みテスト', () => {
    it('ページが正常にロードされる', async () => {
      const title = await page.title()
      expect(title).toBeTruthy()
    })

    it('ヘッダーに "Vespa" と "Admin" が表示される', async () => {
      const headerText = await page.$eval('header', el => el.textContent ?? '')
      expect(headerText).toContain('Vespa')
      expect(headerText).toContain('Admin')
    })

    it('ナビゲーションタブが 6 つ表示される', async () => {
      const tabCount = await page.$$eval('nav button', tabs => tabs.length)
      expect(tabCount).toBe(6)
    })

    it('全タブのラベルが正しく表示される', async () => {
      const tabLabels = await page.$$eval('nav button', tabs =>
        tabs.map(t => t.textContent ?? '')
      )
      const expectedLabels = ['Search', 'Documents', 'Query Trace', 'Schema', 'Health', 'Logs']
      for (const label of expectedLabels) {
        expect(tabLabels.some(t => t.includes(label))).toBe(true)
      }
    })

    it('ヘルスインジケーターが表示される', async () => {
      const hasIndicator = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('header span'))
        return spans.some(s =>
          ['Connected', 'Disconnected', 'Unknown'].includes(s.textContent?.trim() ?? '')
        )
      })
      expect(hasIndicator).toBe(true)
    })
  })

  // ── タブナビゲーションテスト ─────────────────────────────────────

  describe('タブナビゲーションテスト', () => {
    it('初期表示で Search パネルが表示される', async () => {
      const hasExecuteSearch = await page.evaluate(
        () => Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Execute Search'))
      )
      expect(hasExecuteSearch).toBe(true)
    })

    it('Documents タブをクリックすると Documents パネルが表示される', async () => {
      await clickNavTab(page, 'Documents')
      // DocumentPanel 固有の Doc ID 入力欄が現れるのを待つ
      await page.waitForSelector('input[placeholder*="music::100"]', { timeout: 10000 })
      const isVisible = await page.evaluate(() =>
        document.querySelector('input[placeholder*="music::100"]') !== null
      )
      expect(isVisible).toBe(true)
    })

    it('Query Trace タブをクリックすると Trace パネルが表示される', async () => {
      await clickNavTab(page, 'Trace')
      await page.waitForFunction(
        'Array.from(document.querySelectorAll("button")).some(b => b.textContent.includes("Analyze Query"))',
        { timeout: 10000 }
      )
      const hasAnalyzeQuery = await page.evaluate(
        () => Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Analyze Query'))
      )
      expect(hasAnalyzeQuery).toBe(true)
    })

    it('Schema / Config タブをクリックすると Schema パネルが表示される', async () => {
      await clickNavTab(page, 'Schema')
      // SchemaPanel 固有の "APPLICATION PACKAGE" ラベルを待つ
      await page.waitForFunction(
        'document.body.textContent.includes("APPLICATION PACKAGE")',
        { timeout: 10000 }
      )
      const hasContent = await page.evaluate(() =>
        document.body.textContent?.includes('APPLICATION PACKAGE') ?? false
      )
      expect(hasContent).toBe(true)
    })

    it('Health タブをクリックすると Health パネルが表示される', async () => {
      await clickNavTab(page, 'Health')
      await page.waitForFunction(
        'document.body.textContent.includes("services UP")',
        { timeout: 15000 }
      )
      const hasServicesUp = await page.evaluate(() =>
        document.body.textContent?.includes('services UP') ?? false
      )
      expect(hasServicesUp).toBe(true)
    })

    it('Logs タブをクリックすると Logs パネルが表示される', async () => {
      await clickNavTab(page, 'Logs')
      // LogsPanel 固有の textarea を待つ
      await page.waitForSelector('textarea[aria-label="Vespa log content"]', { timeout: 10000 })
      const isVisible = await page.evaluate(() =>
        document.querySelector('textarea[aria-label="Vespa log content"]') !== null
      )
      expect(isVisible).toBe(true)
    })
  })

  // ── 設定パネルテスト ─────────────────────────────────────────────

  describe('設定パネルテスト', () => {
    it('初期状態で設定パネルが非表示である', async () => {
      const isVisible = await page.evaluate(() =>
        document.body.textContent?.includes('QUERY CONTAINER URL') ?? false
      )
      expect(isVisible).toBe(false)
    })

    it('Settings ボタンをクリックすると設定パネルが表示される', async () => {
      // "Settings" テキストを含むボタンをクリック（Settings ボタン固有）
      await page.click('button::-p-text(Settings)')
      await page.waitForFunction(
        'document.body.textContent.includes("QUERY CONTAINER URL")',
        { timeout: 5000 }
      )
      const isVisible = await page.evaluate(() =>
        document.body.textContent?.includes('QUERY CONTAINER URL') ?? false
      )
      expect(isVisible).toBe(true)
    })

    it('Settings ボタンを再度クリックすると設定パネルが閉じる', async () => {
      // 開く
      await page.click('button::-p-text(Settings)')
      await page.waitForFunction(
        'document.body.textContent.includes("QUERY CONTAINER URL")',
        { timeout: 5000 }
      )
      // 閉じる
      await page.click('button::-p-text(Settings)')
      await page.waitForFunction(
        '!document.body.textContent.includes("QUERY CONTAINER URL")',
        { timeout: 5000 }
      )
      const isVisible = await page.evaluate(() =>
        document.body.textContent?.includes('QUERY CONTAINER URL') ?? false
      )
      expect(isVisible).toBe(false)
    })
  })

  // ── フォントサイズ切り替えテスト ──────────────────────────────────

  describe('フォントサイズ切り替えテスト', () => {
    it('フォントサイズ切り替えボタンが表示される', async () => {
      const hasButton = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button')).some(b =>
          b.getAttribute('aria-label')?.includes('文字サイズ')
        )
      )
      expect(hasButton).toBe(true)
    })

    it('初期状態のフォントサイズは「中」である', async () => {
      const label = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('文字サイズ')
        )
        return btn?.getAttribute('aria-label') ?? ''
      })
      expect(label).toContain('中です')
    })

    it('ボタンをクリックするとフォントサイズが「大」に切り替わる', async () => {
      // aria-label で一意にフォントサイズボタンを特定してクリック
      await page.click('button[aria-label*="文字サイズ"]')
      await page.waitForFunction(
        'Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("aria-label")?.includes("文字サイズ"))?.getAttribute("aria-label")?.includes("大です") ?? false',
        { timeout: 5000 }
      )
      const label = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.getAttribute('aria-label')?.includes('文字サイズ')
        )
        return btn?.getAttribute('aria-label') ?? ''
      })
      expect(label).toContain('大です')
    })
  })
})
