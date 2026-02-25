import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HealthPanel from '@/components/HealthPanel'

global.fetch = jest.fn()

/** 全サービスを DOWN に返すデフォルトモック */
const mockAllDown = () =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ ok: false, status: 0, error: 'connection refused' }),
  })

/** 全サービスを UP に返すモック */
const mockAllUp = () =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, data: { status: { code: 'up' } } }),
  })

const PROPS = { vespaUrl: 'http://localhost:8081', configUrl: 'http://localhost:19071' }

describe('HealthPanel', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  // ── スモークテスト ───────────────────────────────────────────

  it('クラッシュせずにレンダリングされる', async () => {
    mockAllDown()
    render(<HealthPanel {...PROPS} />)
    await waitFor(() => expect(screen.getByText('↻ Refresh')).toBeInTheDocument())
  })

  it('サービス一覧のヘッダーが表示される', async () => {
    mockAllDown()
    render(<HealthPanel {...PROPS} />)
    await waitFor(() => expect(screen.getByText(/services UP/)).toBeInTheDocument())
  })

  // ── UP / DOWN バッジ表示 ─────────────────────────────────────

  it('全サービスが UP のとき UP バッジが表示される', async () => {
    mockAllUp()
    render(<HealthPanel {...PROPS} />)
    // 4 サービス全て UP → 複数の "UP" テキストが存在する
    await waitFor(() => {
      const badges = screen.getAllByText('UP')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('全サービスが DOWN のとき DOWN バッジが表示される', async () => {
    mockAllDown()
    render(<HealthPanel {...PROPS} />)
    await waitFor(() => {
      const badges = screen.getAllByText('DOWN')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  it('全サービスが UP のとき "4/4 services UP" が表示される', async () => {
    mockAllUp()
    render(<HealthPanel {...PROPS} />)
    await waitFor(() =>
      expect(screen.getByText('4/4 services UP')).toBeInTheDocument()
    )
  })

  it('全サービスが DOWN のとき "0/4 services UP" が表示される', async () => {
    mockAllDown()
    render(<HealthPanel {...PROPS} />)
    await waitFor(() =>
      expect(screen.getByText('0/4 services UP')).toBeInTheDocument()
    )
  })

  // ── ローディング状態 ─────────────────────────────────────────

  it('ローディング中は "⟳ Checking..." が表示されボタンが disabled になる', async () => {
    // 解決しない Promise で loading 状態を保持する
    ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}))
    render(<HealthPanel {...PROPS} />)
    const btn = await screen.findByText('⟳ Checking...')
    expect(btn).toBeInTheDocument()
    expect(btn.closest('button')).toBeDisabled()
  })

  // ── Refresh ボタン ────────────────────────────────────────────

  it('Refresh ボタンをクリックすると再フェッチが走る', async () => {
    mockAllDown()
    render(<HealthPanel {...PROPS} />)
    // 初回ロード完了を待つ
    await waitFor(() => expect(screen.getByText('↻ Refresh')).toBeInTheDocument())

    const callsAfterMount = (global.fetch as jest.Mock).mock.calls.length
    expect(callsAfterMount).toBeGreaterThan(0)

    // Refresh クリック
    await act(async () => {
      await userEvent.click(screen.getByText('↻ Refresh'))
    })

    await waitFor(() =>
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(callsAfterMount)
    )
  })
})
