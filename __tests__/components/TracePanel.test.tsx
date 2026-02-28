import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TracePanel from '@/components/TracePanel'

global.fetch = jest.fn()

const PROPS = { vespaUrl: 'http://localhost:8081', configUrl: 'http://localhost:19071' }

/** 正常なトレースレスポンスを返すモック */
const mockTraceSuccess = () =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        root: { fields: { totalCount: 0 }, children: [], coverage: { coverage: 100 } },
        trace: {
          children: [
            { message: 'Query parsed successfully' },
            { message: 'Rank profile applied' },
          ],
        },
      },
    }),
  })

/** エラーレスポンスを返すモック */
const mockTraceError = (error = 'Connection refused') =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ ok: false, error }),
  })

describe('TracePanel', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  // ── スモークテスト ────────────────────────────────────────────

  it('クラッシュせずにレンダリングされる', () => {
    render(<TracePanel {...PROPS} />)
    expect(screen.getByText('QUERY ANALYZER')).toBeInTheDocument()
  })

  it('YQL 入力エリアが表示される', () => {
    render(<TracePanel {...PROPS} />)
    expect(screen.getByText('YQL')).toBeInTheDocument()
  })

  it('Analyze Query ボタンが表示される', () => {
    render(<TracePanel {...PROPS} />)
    expect(screen.getByText('🔬 Analyze Query')).toBeInTheDocument()
  })

  it('trace.level セレクターが表示される', () => {
    render(<TracePanel {...PROPS} />)
    expect(screen.getByText('trace.level (1-9)')).toBeInTheDocument()
  })

  it('初期 YQL に userQuery() が含まれる場合、query フィールドが警告付きで表示される', () => {
    render(<TracePanel {...PROPS} />)
    // query ラベルに userQuery() の注釈が表示されることを確認
    expect(screen.getByText(/userQuery\(\) の展開テキスト/)).toBeInTheDocument()
  })

  // ── userQuery() 警告 ──────────────────────────────────────────

  it('YQL に userQuery() があり query が空のとき警告が表示される', async () => {
    render(<TracePanel {...PROPS} />)
    // 初期状態では query = 'vespa' なので警告は表示されていない
    // query をクリアすると needsQuery = true になり警告が表示される
    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.clear(queryInput)
    await waitFor(() =>
      expect(screen.getByText(/query を入力してください/)).toBeInTheDocument()
    )
  })

  it('query フィールドに入力すると警告が消えて Analyze Query ボタンが有効になる', async () => {
    render(<TracePanel {...PROPS} />)

    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.type(queryInput, 'vespa')

    await waitFor(() => {
      expect(screen.getByText('🔬 Analyze Query')).not.toBeDisabled()
    })
  })

  // ── Analyze Query 実行 ────────────────────────────────────────

  it('Analyze Query をクリックすると /api/vespa にリクエストが発行される', async () => {
    mockTraceSuccess()
    render(<TracePanel {...PROPS} />)

    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.type(queryInput, 'vespa')

    await userEvent.click(screen.getByText('🔬 Analyze Query'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/vespa')
    const body = JSON.parse(opts.body as string)
    expect(body.params['trace.level']).toBe('4')
    expect(body.vespaUrl).toBe(PROPS.vespaUrl)
  })

  it('トレース成功時に TRACE LOG セクションが表示される', async () => {
    mockTraceSuccess()
    render(<TracePanel {...PROPS} />)

    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.type(queryInput, 'vespa')

    await userEvent.click(screen.getByText('🔬 Analyze Query'))

    await waitFor(() =>
      expect(screen.getByText(/TRACE LOG/)).toBeInTheDocument()
    )
  })

  it('トレース成功時にトレースメッセージが表示される', async () => {
    mockTraceSuccess()
    render(<TracePanel {...PROPS} />)

    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.type(queryInput, 'vespa')

    await userEvent.click(screen.getByText('🔬 Analyze Query'))

    await waitFor(() =>
      expect(screen.getByText('Query parsed successfully')).toBeInTheDocument()
    )
  })

  it('エラーレスポンス時にエラーメッセージが表示される', async () => {
    mockTraceError('Vespa is not available')
    render(<TracePanel {...PROPS} />)

    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.type(queryInput, 'vespa')

    await userEvent.click(screen.getByText('🔬 Analyze Query'))

    await waitFor(() =>
      expect(screen.getByText(/Vespa is not available/)).toBeInTheDocument()
    )
  })

  // ── Ctrl+Enter で実行 ─────────────────────────────────────────

  it('YQL テキストエリアで Ctrl+Enter を押すとトレース実行はされない（query 未入力）', async () => {
    render(<TracePanel {...PROPS} />)

    const yqlTextarea = document.querySelector('textarea.code-editor') as HTMLTextAreaElement
    fireEvent.keyDown(yqlTextarea, { key: 'Enter', ctrlKey: true })

    // query が空なので fetch は呼ばれない
    expect(global.fetch).not.toHaveBeenCalled()
  })

  // ── raw JSON 切り替え ─────────────────────────────────────────

  it('トレース結果表示後に raw JSON ボタンをクリックすると JSON 表示に切り替わる', async () => {
    mockTraceSuccess()
    render(<TracePanel {...PROPS} />)

    const queryInput = screen.getByPlaceholderText(/例: vespa search/)
    await userEvent.type(queryInput, 'vespa')
    await userEvent.click(screen.getByText('🔬 Analyze Query'))

    await waitFor(() => screen.getByText(/TRACE LOG/))

    await userEvent.click(screen.getByText('raw JSON'))
    await waitFor(() =>
      expect(screen.getByText('parsed')).toBeInTheDocument()
    )
  })
})
