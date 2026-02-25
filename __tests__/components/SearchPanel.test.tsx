import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchPanel from '@/components/SearchPanel'

global.fetch = jest.fn()

const PROPS = { vespaUrl: 'http://localhost:8081', configUrl: 'http://localhost:19071' }

/** 正常な検索レスポンスを返すモック */
const mockSearchSuccess = (totalCount = 1, hits: object[] = []) =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        root: {
          fields: { totalCount },
          children: hits,
          coverage: { coverage: 100 },
        },
      },
    }),
  })

/** エラーレスポンスを返すモック */
const mockSearchError = (error = 'Connection refused') =>
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ ok: false, error }),
  })

describe('SearchPanel', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  // ── スモークテスト ───────────────────────────────────────────

  it('クラッシュせずにレンダリングされる', () => {
    render(<SearchPanel {...PROPS} />)
    expect(screen.getByText('▶ Execute Search')).toBeInTheDocument()
  })

  it('YQLエディターが初期値を持つ', () => {
    render(<SearchPanel {...PROPS} />)
    const textarea = screen.getByPlaceholderText(
      'select * from sources * where userQuery()'
    )
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('select * from doc where true')
  })

  it('PARAMETERSセクションが表示される', () => {
    render(<SearchPanel {...PROPS} />)
    expect(screen.getByText('PARAMETERS')).toBeInTheDocument()
  })

  // ── Execute ボタン → fetch 呼び出し ──────────────────────────

  it('Executeボタンをクリックすると /api/vespa にリクエストが発行される', async () => {
    mockSearchSuccess()
    render(<SearchPanel {...PROPS} />)

    await userEvent.click(screen.getByText('▶ Execute Search'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/vespa')
    const sentBody = JSON.parse(opts.body as string)
    expect(sentBody.endpoint).toBe('/search/')
    expect(sentBody.method).toBe('GET')
    expect(sentBody.params.yql).toBe('select * from doc where true')
  })

  it('実行リクエストに vespaUrl / configUrl が含まれる', async () => {
    mockSearchSuccess()
    render(<SearchPanel {...PROPS} />)

    await userEvent.click(screen.getByText('▶ Execute Search'))

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    const sentBody = JSON.parse(
      ((global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit])[1].body as string
    )
    expect(sentBody.vespaUrl).toBe(PROPS.vespaUrl)
    expect(sentBody.configUrl).toBe(PROPS.configUrl)
  })

  // ── エラー時の表示 ────────────────────────────────────────────

  it('エラーレスポンス時にエラーメッセージが表示される', async () => {
    mockSearchError('Vespa is not available')
    render(<SearchPanel {...PROPS} />)

    await userEvent.click(screen.getByText('▶ Execute Search'))

    await waitFor(() =>
      expect(screen.getByText(/Vespa is not available/)).toBeInTheDocument()
    )
  })

  // ── 成功時の結果表示 ──────────────────────────────────────────

  it('成功レスポンス時に RESULTS セクションと totalCount が表示される', async () => {
    mockSearchSuccess(42)
    render(<SearchPanel {...PROPS} />)

    await userEvent.click(screen.getByText('▶ Execute Search'))

    await waitFor(() => {
      expect(screen.getByText('RESULTS')).toBeInTheDocument()
      expect(screen.getByText('42')).toBeInTheDocument()
    })
  })

  it('ヒットが返された場合、ヒットカードが表示される', async () => {
    const hits = [
      { id: 'id:ns:doc::1', relevance: 0.987, fields: { title: 'My Document' } },
    ]
    mockSearchSuccess(1, hits)
    render(<SearchPanel {...PROPS} />)

    await userEvent.click(screen.getByText('▶ Execute Search'))

    await waitFor(() => expect(screen.getByText('id:ns:doc::1')).toBeInTheDocument())
  })

  // ── Ctrl+Enter で実行 ─────────────────────────────────────────

  it('YQL テキストエリアで Ctrl+Enter を押すと検索が実行される', async () => {
    mockSearchSuccess()
    render(<SearchPanel {...PROPS} />)

    const textarea = screen.getByPlaceholderText(
      'select * from sources * where userQuery()'
    )
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
  })

  // ── Reset ボタン ──────────────────────────────────────────────

  it('YQL を変更後、Resetボタンをクリックすると初期値に戻る', async () => {
    render(<SearchPanel {...PROPS} />)

    const textarea = screen.getByPlaceholderText(
      'select * from sources * where userQuery()'
    ) as HTMLTextAreaElement

    // YQL を変更
    await userEvent.clear(textarea)
    await userEvent.type(textarea, 'select * from news where true')
    expect(textarea.value).toBe('select * from news where true')

    // Reset クリック
    await userEvent.click(screen.getByText('Reset'))
    expect(textarea.value).toBe('select * from doc where true')
  })
})
