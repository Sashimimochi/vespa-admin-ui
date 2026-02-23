import { render, screen } from '@testing-library/react'
import SearchPanel from '@/components/SearchPanel'

describe('SearchPanel', () => {
  it('クラッシュせずにレンダリングされる', () => {
    render(
      <SearchPanel
        vespaUrl="http://localhost:8081"
        configUrl="http://localhost:19071"
      />
    )
    expect(screen.getByText('▶ Execute Search')).toBeInTheDocument()
  })

  it('YQLエディターが初期値を持つ', () => {
    render(
      <SearchPanel
        vespaUrl="http://localhost:8081"
        configUrl="http://localhost:19071"
      />
    )
    const textarea = screen.getByPlaceholderText(
      'select * from sources * where userQuery()'
    )
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveValue('select * from doc where true')
  })

  it('PARAMETERSセクションが表示される', () => {
    render(
      <SearchPanel
        vespaUrl="http://localhost:8081"
        configUrl="http://localhost:19071"
      />
    )
    expect(screen.getByText('PARAMETERS')).toBeInTheDocument()
  })
})
