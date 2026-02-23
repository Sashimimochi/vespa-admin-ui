import { render, screen, waitFor } from '@testing-library/react'
import HealthPanel from '@/components/HealthPanel'

global.fetch = jest.fn()

describe('HealthPanel', () => {
  beforeEach(() => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, status: 0, error: 'connection refused' }),
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('クラッシュせずにレンダリングされる', async () => {
    render(
      <HealthPanel
        vespaUrl="http://localhost:8081"
        configUrl="http://localhost:19071"
      />
    )
    await waitFor(() =>
      expect(screen.getByText('↻ Refresh')).toBeInTheDocument()
    )
  })

  it('サービス一覧のヘッダーが表示される', async () => {
    render(
      <HealthPanel
        vespaUrl="http://localhost:8081"
        configUrl="http://localhost:19071"
      />
    )
    await waitFor(() =>
      expect(screen.getByText(/services UP/)).toBeInTheDocument()
    )
  })
})
