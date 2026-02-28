import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Home from '@/app/page'

global.fetch = jest.fn()

/** /api/config と /api/vespa の両方に対応するデフォルトモック */
const mockFetchDefault = () => {
  ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
    if (url === '/api/config') {
      return Promise.resolve({ ok: true, json: async () => ({}) })
    }
    // /api/vespa (ヘルスチェック等)
    return Promise.resolve({
      ok: true,
      json: async () => ({ ok: true, data: { status: { code: 'up' } } }),
    })
  })
}

describe('Home ページ (E2E テスト)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockFetchDefault()
  })

  afterEach(() => {
    jest.resetAllMocks()
    localStorage.clear()
  })

  // ── 初期表示 ──────────────────────────────────────────────────

  it('クラッシュせずにレンダリングされる', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByText('⚙ Settings')).toBeInTheDocument())
  })

  it('すべてのタブが表示される', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('🔍 Search')).toBeInTheDocument()
      expect(screen.getByText('📥 Documents')).toBeInTheDocument()
      expect(screen.getByText('🔬 Query Trace')).toBeInTheDocument()
      expect(screen.getByText('💚 Health')).toBeInTheDocument()
      expect(screen.getByText('📋 Logs')).toBeInTheDocument()
    })
  })

  it('初期状態で Search タブのコンテンツが表示される', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByText('▶ Execute Search')).toBeInTheDocument())
  })

  // ── タブ切り替え ──────────────────────────────────────────────

  it('Documents タブに切り替えるとドキュメント操作パネルが表示される', async () => {
    render(<Home />)
    await userEvent.click(screen.getByText('📥 Documents'))
    await waitFor(() => expect(screen.getByText('OPERATION')).toBeInTheDocument())
  })

  it('Logs タブに切り替えるとログパネルが表示される', async () => {
    render(<Home />)
    await userEvent.click(screen.getByText('📋 Logs'))
    await waitFor(() => expect(screen.getByText('Parse Logs')).toBeInTheDocument())
  })

  it('Health タブに切り替えるとヘルスパネルが表示される', async () => {
    render(<Home />)
    await userEvent.click(screen.getByText('💚 Health'))
    await waitFor(() => expect(screen.getByText('↻ Refresh')).toBeInTheDocument())
  })

  it('Query Trace タブに切り替えるとトレースパネルが表示される', async () => {
    render(<Home />)
    await userEvent.click(screen.getByText('🔬 Query Trace'))
    await waitFor(() => expect(screen.getByText('QUERY ANALYZER')).toBeInTheDocument())
  })

  it('別のタブに切り替えると元のタブのコンテンツが非表示になる', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByText('▶ Execute Search')).toBeInTheDocument())

    await userEvent.click(screen.getByText('📋 Logs'))

    await waitFor(() => {
      expect(screen.queryByText('▶ Execute Search')).not.toBeInTheDocument()
      expect(screen.getByText('Parse Logs')).toBeInTheDocument()
    })
  })

  it('タブを切り替えて Search に戻ると Search コンテンツが再表示される', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByText('▶ Execute Search')).toBeInTheDocument())

    await userEvent.click(screen.getByText('📋 Logs'))
    await waitFor(() => expect(screen.queryByText('▶ Execute Search')).not.toBeInTheDocument())

    await userEvent.click(screen.getByText('🔍 Search'))
    await waitFor(() => expect(screen.getByText('▶ Execute Search')).toBeInTheDocument())
  })

  // ── Settings パネル ───────────────────────────────────────────

  it('Settings ボタンをクリックすると設定パネルが表示される', async () => {
    render(<Home />)
    await waitFor(() => screen.getByText('⚙ Settings'))

    await userEvent.click(screen.getByText('⚙ Settings'))

    await waitFor(() => {
      expect(screen.getByText('QUERY CONTAINER URL')).toBeInTheDocument()
      expect(screen.getByText('FEED CONTAINER URL')).toBeInTheDocument()
      expect(screen.getByText('CONFIG SERVER URL')).toBeInTheDocument()
    })
  })

  it('Settings ボタンを2回クリックすると設定パネルが閉じる', async () => {
    render(<Home />)
    await waitFor(() => screen.getByText('⚙ Settings'))

    await userEvent.click(screen.getByText('⚙ Settings'))
    await waitFor(() => expect(screen.getByText('QUERY CONTAINER URL')).toBeInTheDocument())

    await userEvent.click(screen.getByText('⚙ Settings'))
    await waitFor(() =>
      expect(screen.queryByText('QUERY CONTAINER URL')).not.toBeInTheDocument()
    )
  })

  it('Reset defaults ボタンをクリックするとデフォルト URL にリセットされる', async () => {
    render(<Home />)
    await userEvent.click(screen.getByText('⚙ Settings'))
    await waitFor(() => screen.getByText('↺ Reset defaults'))

    await userEvent.click(screen.getByText('↺ Reset defaults'))

    await waitFor(() => {
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
      const values = inputs.map(i => i.value)
      expect(values).toContain('http://localhost:8081')
      expect(values).toContain('http://localhost:8080')
      expect(values).toContain('http://localhost:19071')
    })
  })

  // ── フォントサイズ切り替え ────────────────────────────────────

  it('フォントサイズボタンをクリックすると大サイズに変わる', async () => {
    render(<Home />)
    await waitFor(() => screen.getByTitle('文字サイズ: 中 (クリックで大に変更)'))

    const fontBtn = screen.getByTitle('文字サイズ: 中 (クリックで大に変更)')
    expect(fontBtn).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(fontBtn)

    await waitFor(() => {
      expect(screen.getByTitle('文字サイズ: 大 (クリックで中に変更)')).toBeInTheDocument()
    })
  })

  it('フォントサイズボタンを2回クリックすると中サイズに戻る', async () => {
    render(<Home />)
    await waitFor(() => screen.getByTitle('文字サイズ: 中 (クリックで大に変更)'))

    await userEvent.click(screen.getByTitle('文字サイズ: 中 (クリックで大に変更)'))
    await waitFor(() => screen.getByTitle('文字サイズ: 大 (クリックで中に変更)'))

    await userEvent.click(screen.getByTitle('文字サイズ: 大 (クリックで中に変更)'))
    await waitFor(() => {
      expect(screen.getByTitle('文字サイズ: 中 (クリックで大に変更)')).toBeInTheDocument()
    })
  })

  it('フォントサイズが大のとき aria-pressed が true になる', async () => {
    render(<Home />)
    await waitFor(() => screen.getByTitle('文字サイズ: 中 (クリックで大に変更)'))

    await userEvent.click(screen.getByTitle('文字サイズ: 中 (クリックで大に変更)'))

    await waitFor(() => {
      const btn = screen.getByTitle('文字サイズ: 大 (クリックで中に変更)')
      expect(btn).toHaveAttribute('aria-pressed', 'true')
    })
  })

  // ── ヘルスステータス表示 ──────────────────────────────────────

  it('ヘルスチェック成功時に Connected が表示される', async () => {
    render(<Home />)
    await waitFor(() => expect(screen.getByText('Connected')).toBeInTheDocument())
  })

  it('ヘルスチェック失敗時に Disconnected が表示される', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/config') {
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: false }),
      })
    })

    render(<Home />)
    await waitFor(() => expect(screen.getByText('Disconnected')).toBeInTheDocument())
  })
})
