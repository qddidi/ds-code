import { describe, expect, it } from 'vitest'
import { getVisibleStreamingText } from '../../src/cli/components/streaming-text.js'
import { renderStreamingMarkdown } from '../../src/cli/output.js'

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

describe('renderStreamingMarkdown', () => {
  it('renders completed markdown blocks while keeping the pending fragment as text', () => {
    const output = renderStreamingMarkdown('# Title\n\npartial **bold')

    expect(output).toContain('Title')
    expect(output).toContain('partial **bold')
  })

  it('does not render an unfinished fenced code block', () => {
    const input = '```ts\nconst value = 1'

    expect(renderStreamingMarkdown(input)).toBe(input)
  })

  it('renders a closed fenced code block before an unfinished following fragment', () => {
    const output = renderStreamingMarkdown('```ts\nconst value = 1\n```\nunfinished **bold')

    expect(output).toContain('const')
    expect(output).toContain('value')
    expect(output).toContain('unfinished **bold')
  })
})
