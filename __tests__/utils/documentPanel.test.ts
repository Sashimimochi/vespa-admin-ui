import {
  autoWrapAssign,
  parseVespaDocId,
  isDocApiNotConfigured,
} from '@/components/DocumentPanel'

describe('autoWrapAssign', () => {
  it('非オブジェクト入力はそのまま返す', () => {
    expect(autoWrapAssign(null)).toBeNull()
    expect(autoWrapAssign('string')).toBe('string')
    expect(autoWrapAssign(42)).toBe(42)
  })

  it('fieldsを持たないオブジェクトはそのまま返す', () => {
    const input = { other: 'value' }
    expect(autoWrapAssign(input)).toEqual(input)
  })

  it('単純文字列フィールドをassignでラップする', () => {
    const input = { fields: { title: 'Hello' } }
    expect(autoWrapAssign(input)).toEqual({
      fields: { title: { assign: 'Hello' } },
    })
  })

  it('数値フィールドをassignでラップする', () => {
    const input = { fields: { year: 2024 } }
    expect(autoWrapAssign(input)).toEqual({
      fields: { year: { assign: 2024 } },
    })
  })

  it('nullフィールドをassignでラップする', () => {
    const input = { fields: { optional: null } }
    expect(autoWrapAssign(input)).toEqual({
      fields: { optional: { assign: null } },
    })
  })

  it('配列フィールドをassignでラップする', () => {
    const input = { fields: { tags: ['a', 'b'] } }
    expect(autoWrapAssign(input)).toEqual({
      fields: { tags: { assign: ['a', 'b'] } },
    })
  })

  it('すでにオブジェクト形式のフィールドはそのまま保持する', () => {
    const input = { fields: { count: { increment: 1 } } }
    expect(autoWrapAssign(input)).toEqual({
      fields: { count: { increment: 1 } },
    })
  })

  it('複数フィールドを混在処理する', () => {
    const input = {
      fields: {
        title: 'Hello',
        count: { increment: 1 },
        active: true,
      },
    }
    expect(autoWrapAssign(input)).toEqual({
      fields: {
        title: { assign: 'Hello' },
        count: { increment: 1 },
        active: { assign: true },
      },
    })
  })
})

describe('parseVespaDocId', () => {
  it('正しいVespa IDを解析する', () => {
    const result = parseVespaDocId('id:music:music::doc1')
    expect(result).toEqual({ namespace: 'music', docType: 'music', userId: 'doc1' })
  })

  it('ユーザーIDにコロンを含む場合も正しく解析する', () => {
    const result = parseVespaDocId('id:myns:mytype::part1:part2')
    expect(result).toEqual({ namespace: 'myns', docType: 'mytype', userId: 'part1:part2' })
  })

  it('不正なフォーマットはnullを返す', () => {
    expect(parseVespaDocId('not-a-vespa-id')).toBeNull()
    expect(parseVespaDocId('')).toBeNull()
    expect(parseVespaDocId('id:music:music:doc1')).toBeNull()
  })
})

describe('isDocApiNotConfigured', () => {
  it('Document APIが未設定のレスポンスでtrueを返す', () => {
    const data = {
      'error-code': 'NOT_FOUND',
      message: 'Document API is not configured',
    }
    expect(isDocApiNotConfigured(data)).toBe(true)
  })

  it('error-codeが異なる場合はfalseを返す', () => {
    const data = {
      'error-code': 'BAD_REQUEST',
      message: 'Document API is not configured',
    }
    expect(isDocApiNotConfigured(data)).toBe(false)
  })

  it('messageが異なる場合はfalseを返す', () => {
    const data = {
      'error-code': 'NOT_FOUND',
      message: 'Other error',
    }
    expect(isDocApiNotConfigured(data)).toBe(false)
  })

  it('nullや非オブジェクトの場合はfalseを返す', () => {
    expect(isDocApiNotConfigured(null)).toBe(false)
    expect(isDocApiNotConfigured('string')).toBe(false)
    expect(isDocApiNotConfigured(undefined)).toBe(false)
  })
})
