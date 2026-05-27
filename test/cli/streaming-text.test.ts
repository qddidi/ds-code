import { describe, expect, it } from 'vitest'
import { getRenderedStreamingText, getStreamingReservedRows, getVisibleStreamingText } from '../../src/cli/components/streaming-text.js'

describe('getVisibleStreamingText', () => {
  it('reserves only the live input area by default', () => {
    expect(getStreamingReservedRows()).toBe(2)
  })

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

  it('uses the default live input reserve when viewport reserve is omitted', () => {
    const result = getVisibleStreamingText(['one', 'two', 'three', 'four', 'five'].join('\n'), { columns: 80, rows: 8 })

    expect(result.omittedRows).toBe(0)
    expect(result.text).toBe(['one', 'two', 'three', 'four', 'five'].join('\n'))
  })

  it('trims a partially visible line before rendering it', () => {
    const result = getVisibleStreamingText('  0123456789abcdefghijK', { columns: 10, rows: 8, reservedRows: 6 })

    expect(result.text).toBe('123456789abcdefghijK')
  })

  it('renders the raw viewport tail while streaming', () => {
    const output = getRenderedStreamingText('# first\n\n# second', true, { columns: 80, rows: 5, reservedRows: 4 })

    expect(output).toBe('# second')
  })

  it('renders the complete markdown content after streaming ends', () => {
    const input = ['# Summary', '', '- first', '- second', '- third', '- fourth'].join('\n')
    const output = getRenderedStreamingText(input, false, { columns: 80, rows: 8, reservedRows: 5 })

    expect(output).toContain('Summary')
    expect(output).toContain('first')
    expect(output).toContain('fourth')
  })
})
