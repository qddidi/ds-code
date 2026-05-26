import { describe, expect, it } from 'vitest'
import { formatInitError, shouldRenderStreamingText, shouldShowToolResult } from '../../src/cli/app.js'

describe('formatInitError', () => {
  it('uses Error message', () => {
    expect(formatInitError(new Error('bad config'))).toBe('bad config')
  })

  it('stringifies non-error values', () => {
    expect(formatInitError('failed')).toBe('failed')
  })
})

describe('shouldShowToolResult', () => {
  it('shows display-only results', () => {
    expect(shouldShowToolResult({ name: 'edit_file', args: {}, done: true, error: false, result: 'ok', displayResult: 'diff' })).toBe(true)
    expect(shouldShowToolResult({ name: 'write_file', args: {}, done: true, error: false, result: 'ok', displayResult: 'diff' })).toBe(true)
    expect(shouldShowToolResult({ name: 'bash', args: {}, done: true, error: false, result: 'ok', displayResult: 'diff' })).toBe(true)
  })

  it('shows error results', () => {
    expect(shouldShowToolResult({ name: 'bash', args: {}, done: true, error: true, result: 'failed' })).toBe(true)
  })

  it('hides successful results without display content', () => {
    expect(shouldShowToolResult({ name: 'bash', args: {}, done: true, error: false, result: 'stdout="ok"' })).toBe(false)
    expect(shouldShowToolResult({ name: 'edit_file', args: {}, done: true, error: false, result: 'Replaced 1 occurrence' })).toBe(false)
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

