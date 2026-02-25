import { parseVespaLog } from '@/components/LogsPanel'

// ── Vespa タブ区切りフォーマット ────────────────────────────────────────────
// フォーマット: timestamp\thost\tpid\tservice\tcomponent\tlevel\tmessage

describe('parseVespaLog — Vespa タブ区切りフォーマット', () => {
  it('空文字列は空配列を返す', () => {
    expect(parseVespaLog('')).toEqual([])
  })

  it('空行のみの文字列は空配列を返す', () => {
    expect(parseVespaLog('\n\n\n')).toEqual([])
  })

  it('7フィールド以上のタブ区切り行を正しく解析する', () => {
    const line = '2024-01-15T12:34:56.789\thostname\t1234\tvespa.container\tcom.yahoo.App\tinfo\tStarting container'
    const result = parseVespaLog(line)
    expect(result).toHaveLength(1)
    expect(result[0].timestamp).toBe('2024-01-15T12:34:56.789')
    expect(result[0].level).toBe('info')
    expect(result[0].component).toBe('com.yahoo.App')
    expect(result[0].message).toBe('Starting container')
    expect(result[0].raw).toBe(line)
  })

  it('levelが小文字に正規化される', () => {
    const line = '2024-01-15T12:34:56\thostname\t1234\tservice\tcomponent\tWARNING\tSome warning'
    const result = parseVespaLog(line)
    expect(result[0].level).toBe('warning')
  })

  it('componentはparts[4]を優先し、空の場合はparts[3]にフォールバックする', () => {
    // parts[4] が空・parts[3] が "vespa.service"
    const lineWithComponent = '2024-01-15\thost\t1\tvespa.service\tcom.yahoo.Comp\tinfo\tMsg'
    expect(parseVespaLog(lineWithComponent)[0].component).toBe('com.yahoo.Comp')

    // parts[4] が空文字列のときは parts[3] になる
    const lineNoComponent = '2024-01-15\thost\t1\tvespa.service\t\tinfo\tMsg'
    expect(parseVespaLog(lineNoComponent)[0].component).toBe('vespa.service')
  })

  it('メッセージ部にタブが含まれる場合も正しく結合する', () => {
    // parts[6] 以降を join('\t') するので、メッセージ内のタブは保持される
    const line = '2024-01-15\thost\t1\tsvc\tcomp\tinfo\tpart1\tpart2\tpart3'
    const result = parseVespaLog(line)
    expect(result[0].message).toBe('part1\tpart2\tpart3')
  })

  it('複数行を正しく解析し、空行をスキップする', () => {
    const raw = [
      '2024-01-15T12:00:00\thost\t1\tsvc\tcomp\tinfo\tFirst message',
      '',
      '2024-01-15T12:00:01\thost\t2\tsvc\tcomp\terror\tSecond message',
    ].join('\n')
    const result = parseVespaLog(raw)
    expect(result).toHaveLength(2)
    expect(result[0].message).toBe('First message')
    expect(result[1].level).toBe('error')
    expect(result[1].message).toBe('Second message')
  })

  it('6フィールド以下のタブ区切り行はJSONパース or フォールバックに移行する', () => {
    // 6フィールド（7未満）→ JSON でもない → フォールバック
    const line = 'a\tb\tc\td\te\tf'  // 6 parts
    const result = parseVespaLog(line)
    expect(result[0].message).toBe(line)
    expect(result[0].level).toBe('info')
  })
})

// ── JSON ラインフォーマット ────────────────────────────────────────────────

describe('parseVespaLog — JSON フォーマット', () => {
  it('timestamp/level/component/message フィールドを解析する', () => {
    const obj = { timestamp: '2024-01-15T12:00:00Z', level: 'ERROR', component: 'MyComp', message: 'Something went wrong' }
    const result = parseVespaLog(JSON.stringify(obj))
    expect(result).toHaveLength(1)
    expect(result[0].timestamp).toBe('2024-01-15T12:00:00Z')
    expect(result[0].level).toBe('error')
    expect(result[0].component).toBe('MyComp')
    expect(result[0].message).toBe('Something went wrong')
  })

  it('time / severity / logger / msg フィールドのエイリアスを受け付ける', () => {
    const obj = { time: '2024-01-15T12:00:00Z', severity: 'WARNING', logger: 'MyLogger', msg: 'Alt fields' }
    const result = parseVespaLog(JSON.stringify(obj))
    expect(result[0].timestamp).toBe('2024-01-15T12:00:00Z')
    expect(result[0].level).toBe('warning')
    expect(result[0].component).toBe('MyLogger')
    expect(result[0].message).toBe('Alt fields')
  })

  it('level/severity が欠落している場合は "info" をデフォルトにする', () => {
    const obj = { message: 'No level field' }
    const result = parseVespaLog(JSON.stringify(obj))
    expect(result[0].level).toBe('info')
  })

  it('timestamp/time が欠落している場合は空文字になる', () => {
    const obj = { level: 'debug', message: 'No timestamp' }
    const result = parseVespaLog(JSON.stringify(obj))
    expect(result[0].timestamp).toBe('')
  })

  it('JSON の message フィールドが欠落している場合は生の行を message にする', () => {
    const obj = { level: 'info' }
    const raw = JSON.stringify(obj)
    const result = parseVespaLog(raw)
    expect(result[0].message).toBe(raw)
  })

  it('raw フィールドには常に元の行文字列が入る', () => {
    const obj = { level: 'info', message: 'hello' }
    const raw = JSON.stringify(obj)
    const result = parseVespaLog(raw)
    expect(result[0].raw).toBe(raw)
  })
})

// ── 生テキスト（フォールバック）────────────────────────────────────────────

describe('parseVespaLog — フォールバック（生テキスト）', () => {
  it('JSONでもタブ区切りでもない行をそのまま message にする', () => {
    const line = 'This is a plain log line'
    const result = parseVespaLog(line)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe(line)
    expect(result[0].timestamp).toBe('')
    expect(result[0].level).toBe('info')
    expect(result[0].component).toBe('')
    expect(result[0].raw).toBe(line)
  })
})
