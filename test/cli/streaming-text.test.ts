import { describe, expect, it } from 'vitest'
import { getVisibleStreamingText } from '../../src/cli/components/streaming-text.js'

describe('getVisibleStreamingText', () => {
  it('limits visible output by wrapped terminal rows', () => {
    const result = getVisibleStreamingText('0123456789abcdefghijK', { columns: 10, rows: 8, reservedRows: 6 })

    expect(result.omittedRows).toBe(1)
    expect(result.text).toBe('123456789abcdefghijK')
  })

  it('keeps the tail of multiline output within the row budget', () => {
    const result = getVisibleStreamingText(['one', 'two', 'three', 'four'].join('\n'), { columns: 80, rows: 8, reservedRows: 5 })

    expect(result.omittedRows).toBe(1)
    expect(result.text).toBe(['two', 'three', 'four'].join('\n'))
  })
})
