import { describe, expect, it } from 'vitest'
import { formatInitError, shouldRenderStreamingText } from '../../src/cli/app.js'

describe('formatInitError', () => {
  it('uses Error message', () => {
    expect(formatInitError(new Error('bad config'))).toBe('bad config')
  })

  it('stringifies non-error values', () => {
    expect(formatInitError('failed')).toBe('failed')
  })
})

describe('shouldRenderStreamingText', () => {
  it('only keeps streaming text mounted while a stream is active', () => {
    expect(shouldRenderStreamingText('final answer', 'idle')).toBe(false)
    expect(shouldRenderStreamingText('final answer', 'thinking')).toBe(false)
    expect(shouldRenderStreamingText('final answer', 'tool')).toBe(false)
    expect(shouldRenderStreamingText('', 'streaming')).toBe(false)
    expect(shouldRenderStreamingText('partial answer', 'streaming')).toBe(true)
  })
})
