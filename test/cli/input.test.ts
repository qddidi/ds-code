import { describe, it, expect } from 'vitest'
import { parseInput, joinMultiline } from '../../src/cli/input.js'

describe('parseInput', () => {
  it('returns empty for blank input', () => {
    expect(parseInput('')).toEqual({ type: 'empty', content: '' })
    expect(parseInput('   ')).toEqual({ type: 'empty', content: '' })
  })

  it('detects slash commands', () => {
    expect(parseInput('/help')).toEqual({ type: 'command', content: '/help' })
    expect(parseInput('/exit')).toEqual({ type: 'command', content: '/exit' })
    expect(parseInput('/clear')).toEqual({ type: 'command', content: '/clear' })
  })

  it('returns message for normal input', () => {
    expect(parseInput('hello')).toEqual({ type: 'message', content: 'hello' })
    expect(parseInput('  fix the bug  ')).toEqual({ type: 'message', content: 'fix the bug' })
  })
})

describe('joinMultiline', () => {
  it('joins lines with backslash continuation', () => {
    const result = joinMultiline(['hello\\', 'world'])
    expect(result).toBe('hello\nworld')
  })

  it('preserves normal newlines', () => {
    const result = joinMultiline(['line1', 'line2'])
    expect(result).toBe('line1\nline2')
  })
})
