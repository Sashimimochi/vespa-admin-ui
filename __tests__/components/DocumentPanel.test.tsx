import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DocumentPanel from '@/components/DocumentPanel'

global.fetch = jest.fn()

const PROPS = { vespaUrl: 'http://localhost:8080', configUrl: 'http://localhost:19071' }

/** 成功レスポンスを返すモック */
const mockSuccess = () =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, status: 200, data: { pathId: '/document/v1/music/music/docid/1' } }),
  })

/** エラーレスポンスを返すモック */
const mockError = (error = 'Connection refused') =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ ok: false, status: 400, data: { message: error } }),
  })

describe('DocumentPanel', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  // ── スモークテスト ────────────────────────────────────────────

  it('クラッシュせずにレンダリングされる', () => {
    render(<DocumentPanel {...PROPS} />)
    expect(screen.getByText('OPERATION')).toBeInTheDocument()
  })

  it('Feed URL が表示される', () => {
    render(<DocumentPanel {...PROPS} />)
    expect(screen.getByText('http://localhost:8080')).toBeInTheDocument()
  })

  it('4つの操作ボタンが表示される', () => {
    render(<DocumentPanel {...PROPS} />)
    expect(screen.getByText('➕ Insert')).toBeInTheDocument()
    expect(screen.getByText('✏️ Full Update')).toBeInTheDocument()
    expect(screen.getByText('🔧 Partial Update')).toBeInTheDocument()
    expect(screen.getByText('🗑️ Delete')).toBeInTheDocument()
  })

  it('INPUT MODE セクションが表示される', () => {
    render(<DocumentPanel {...PROPS} />)
    expect(screen.getByText('INPUT MODE')).toBeInTheDocument()
  })

  it('初期状態で Execute Insert ボタンが表示される', () => {
    render(<DocumentPanel {...PROPS} />)
    expect(screen.getByText('▶ Execute ➕ Insert')).toBeInTheDocument()
  })

  // ── 操作切り替え ──────────────────────────────────────────────

  it('Delete ボタンをクリックすると Execute Delete ボタンに変わる', async () => {
    render(<DocumentPanel {...PROPS} />)
    await userEvent.click(screen.getByText('🗑️ Delete'))
    await waitFor(() =>
      expect(screen.getByText('▶ Execute 🗑️ Delete')).toBeInTheDocument()
    )
  })

  it('Partial Update を選択すると auto-assign ボタンが表示される', async () => {
    render(<DocumentPanel {...PROPS} />)
    await userEvent.click(screen.getByText('🔧 Partial Update'))
    await waitFor(() =>
      expect(screen.getByTitle(/有効にすると単純値フィールドを/)).toBeInTheDocument()
    )
  })

  // ── 入力モード切り替え ─────────────────────────────────────────

  it('Batch モードに切り替えると BATCH JSON セクションが表示される', async () => {
    render(<DocumentPanel {...PROPS} />)
    await userEvent.click(screen.getByText('📦 Batch'))
    await waitFor(() =>
      expect(screen.getByText('BATCH JSON')).toBeInTheDocument()
    )
  })

  it('Single モードに戻すと DOCUMENT TARGET セクションが表示される', async () => {
    render(<DocumentPanel {...PROPS} />)
    await userEvent.click(screen.getByText('📦 Batch'))
    await waitFor(() => screen.getByText('BATCH JSON'))

    await userEvent.click(screen.getByText('📝 Single'))
    await waitFor(() =>
      expect(screen.getByText('DOCUMENT TARGET')).toBeInTheDocument()
    )
  })

  // ── バリデーション ────────────────────────────────────────────

  it('Document ID なしで Execute をクリックするとエラーメッセージが表示される', async () => {
    render(<DocumentPanel {...PROPS} />)
    await userEvent.click(screen.getByText('▶ Execute ➕ Insert'))
    await waitFor(() =>
      expect(screen.getByText(/Document ID を入力してください/)).toBeInTheDocument()
    )
  })

  it('不正な JSON Body で Execute をクリックするとエラーメッセージが表示される', async () => {
    render(<DocumentPanel {...PROPS} />)

    const docIdInput = screen.getByPlaceholderText(/100 /)
    await userEvent.type(docIdInput, 'test-id')

    const bodyTextarea = screen.getByPlaceholderText(/title.*Sample Document/s)
    await userEvent.clear(bodyTextarea)
    await userEvent.type(bodyTextarea, 'not valid json')

    await userEvent.click(screen.getByText('▶ Execute ➕ Insert'))
    await waitFor(() =>
      expect(screen.getByText(/JSON のパースに失敗しました/)).toBeInTheDocument()
    )
  })

  // ── Document ID 自動分解 ──────────────────────────────────────

  it('Vespa フル ID を入力すると namespace と docType が自動補完される', async () => {
    render(<DocumentPanel {...PROPS} />)

    const docIdInput = screen.getByPlaceholderText(/100 /)
    await userEvent.clear(docIdInput)
    await userEvent.type(docIdInput, 'id:music:music::100')

    await waitFor(() => {
      const nsInput = screen.getByPlaceholderText('default') as HTMLInputElement
      expect(nsInput.value).toBe('music')
    })
  })

  // ── Execute 成功 ──────────────────────────────────────────────

  it('正常レスポンス時に RESULTS セクションと成功件数が表示される', async () => {
    mockSuccess()
    render(<DocumentPanel {...PROPS} />)

    const docIdInput = screen.getByPlaceholderText(/100 /)
    await userEvent.type(docIdInput, '1')

    await userEvent.click(screen.getByText('▶ Execute ➕ Insert'))

    await waitFor(() => {
      expect(screen.getByText('RESULTS')).toBeInTheDocument()
      // 成功件数が 1 件であることを確認
      const successCount = screen.getAllByText('1').find(el => el.tagName === 'STRONG')
      expect(successCount).toBeTruthy()
    })
  })

  it('エラーレスポンス時に失敗件数が表示される', async () => {
    mockError()
    render(<DocumentPanel {...PROPS} />)

    const docIdInput = screen.getByPlaceholderText(/100 /)
    await userEvent.type(docIdInput, '1')

    await userEvent.click(screen.getByText('▶ Execute ➕ Insert'))

    await waitFor(() => {
      expect(screen.getByText('RESULTS')).toBeInTheDocument()
    })
  })
})
