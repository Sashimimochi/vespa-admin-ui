import '@testing-library/jest-dom'

// React Testing Library が act() ラッパーを正しく適用するために必要
// 参考: https://github.com/reactwg/react-18/discussions/102
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// React 18 + jsdom 環境では、useEffect 内の async 関数から発火する state 更新が
// act() の外側で実行されたと判定され console.error が出ることがある。
// テストの合否には影響しないが、ノイズを抑制するために警告をフィルタリングする。
const originalError = console.error.bind(console)
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    if (msg.includes('not configured to support act(')) return
    originalError(...args)
  })
})
afterAll(() => {
  ;(console.error as jest.Mock).mockRestore?.()
})
