import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LogsPanel from '@/components/LogsPanel'

describe('LogsPanel', () => {
  // ── スモークテスト ────────────────────────────────────────────

  it('クラッシュせずにレンダリングされる', () => {
    render(<LogsPanel />)
    expect(screen.getByText('Parse Logs')).toBeInTheDocument()
  })

  it('PASTE LOGS セクションが表示される', () => {
    render(<LogsPanel />)
    expect(screen.getByText('PASTE LOGS')).toBeInTheDocument()
  })

  it('ログがない初期状態で "No logs loaded yet" が表示される', () => {
    render(<LogsPanel />)
    expect(screen.getByText('No logs loaded yet')).toBeInTheDocument()
  })

  it('ログ入力用テキストエリアが表示される', () => {
    render(<LogsPanel />)
    expect(
      screen.getByPlaceholderText(/Paste Vespa log content here/)
    ).toBeInTheDocument()
  })

  // ── ログの解析 ────────────────────────────────────────────────

  it('Vespa ログを貼り付けて Parse Logs をクリックするとログ行が表示される', async () => {
    render(<LogsPanel />)

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(
      textarea,
      '1.0\thost\t1\tservice\tcomponent\tinfo\tTest message'
    )

    await userEvent.click(screen.getByText('Parse Logs'))

    await waitFor(() => expect(screen.getByText('Test message')).toBeInTheDocument())
  })

  it('複数行のログを解析すると複数行が表示される', async () => {
    render(<LogsPanel />)

    const logLines = [
      '1.0\thost\t1\tservice\tcomp\tinfo\tFirst message',
      '2.0\thost\t2\tservice\tcomp\terror\tSecond message',
    ].join('\n')

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(textarea, logLines)

    await userEvent.click(screen.getByText('Parse Logs'))

    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument()
      expect(screen.getByText('Second message')).toBeInTheDocument()
    })
  })

  it('ログ解析後にレベル統計バッジが表示される', async () => {
    render(<LogsPanel />)

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(
      textarea,
      '1.0\thost\t1\tservice\tcomp\terror\tError message'
    )

    await userEvent.click(screen.getByText('Parse Logs'))

    await waitFor(() =>
      expect(screen.getByText(/error: 1/)).toBeInTheDocument()
    )
  })

  // ── フィルタリング ────────────────────────────────────────────

  it('ログ解析後にレベルフィルターボタンが表示される', async () => {
    render(<LogsPanel />)

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(
      textarea,
      '1.0\thost\t1\tservice\tcomp\tinfo\tMessage'
    )

    await userEvent.click(screen.getByText('Parse Logs'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'error' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'info' })).toBeInTheDocument()
    })
  })

  it('エラーフィルターをクリックすると info ログが非表示になる', async () => {
    render(<LogsPanel />)

    const logLines = [
      '1.0\thost\t1\tservice\tcomp\tinfo\tInfo message',
      '2.0\thost\t2\tservice\tcomp\terror\tError message',
    ].join('\n')

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(textarea, logLines)

    await userEvent.click(screen.getByText('Parse Logs'))
    await waitFor(() => screen.getByText('Info message'))

    await userEvent.click(screen.getByRole('button', { name: 'error' }))

    await waitFor(() => {
      expect(screen.queryByText('Info message')).not.toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })
  })

  it('all フィルターをクリックするとすべてのログが再表示される', async () => {
    render(<LogsPanel />)

    const logLines = [
      '1.0\thost\t1\tservice\tcomp\tinfo\tInfo message',
      '2.0\thost\t2\tservice\tcomp\terror\tError message',
    ].join('\n')

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(textarea, logLines)

    await userEvent.click(screen.getByText('Parse Logs'))
    await waitFor(() => screen.getByText('Info message'))

    await userEvent.click(screen.getByRole('button', { name: 'error' }))
    await waitFor(() => expect(screen.queryByText('Info message')).not.toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'all' }))

    await waitFor(() => {
      expect(screen.getByText('Info message')).toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })
  })

  it('テキストフィルターに入力するとマッチしたメッセージのみ表示される', async () => {
    render(<LogsPanel />)

    const logLines = [
      '1.0\thost\t1\tservice\tcomp\tinfo\tHello world',
      '2.0\thost\t2\tservice\tcomp\tinfo\tGoodbye world',
    ].join('\n')

    const textarea = screen.getByLabelText('Vespa log content')
    await userEvent.type(textarea, logLines)

    await userEvent.click(screen.getByText('Parse Logs'))
    await waitFor(() => screen.getByText('Hello world'))

    const filterInput = screen.getByPlaceholderText('Filter messages...')
    await userEvent.type(filterInput, 'Hello')

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument()
      expect(screen.queryByText('Goodbye world')).not.toBeInTheDocument()
    })
  })
})
