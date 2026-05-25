import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateMessagesTokens } from '../../src/utils/token-count.js'

describe('estimateTokens', () => {
  it('estimates English text — "hello world" is about 2-3 tokens', () => {
    const count = estimateTokens('hello world')
    expect(count).toBeGreaterThanOrEqual(2)
    expect(count).toBeLessThanOrEqual(4)
  })

  it('estimates Chinese text — "你好世界" is about 4-6 tokens', () => {
    const count = estimateTokens('你好世界')
    expect(count).toBeGreaterThanOrEqual(4)
    expect(count).toBeLessThanOrEqual(8)
  })

  it('estimates code block — 50 lines is in reasonable range', () => {
    const code = Array.from({ length: 50 }, (_, i) =>
      `  const x${i} = ${i} * 2;`
    ).join('\n')

    const count = estimateTokens(code)
    // 50 lines of simple code, roughly 200-400 tokens
    expect(count).toBeGreaterThan(100)
    expect(count).toBeLessThan(600)
  })

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('handles mixed content', () => {
    const text = 'Hello 你好 function foo() { return 42; }'
    const count = estimateTokens(text)
    expect(count).toBeGreaterThan(5)
    expect(count).toBeLessThan(20)
  })

  it('applies a conservative margin to ASCII estimates', () => {
    expect(estimateTokens('abcd')).toBe(2)
  })
})

describe('estimateMessagesTokens', () => {
  it('accounts for per-message overhead', () => {
    const single = estimateMessagesTokens([{ role: 'user', content: 'hi' }])
    const double = estimateMessagesTokens([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ])
    // second message adds content tokens + 4 overhead
    expect(double).toBeGreaterThan(single)
  })

  it('counts tool_calls tokens', () => {
    const withoutTools = estimateMessagesTokens([
      { role: 'assistant', content: 'ok' },
    ])
    const withTools = estimateMessagesTokens([
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'c1',
          type: 'function',
          function: { name: 'read_file', arguments: '{"path":"/tmp/test.ts"}' },
        }],
      },
    ])
    expect(withTools).toBeGreaterThan(withoutTools)
  })

  it('counts tool_call_id overhead', () => {
    const msg = estimateMessagesTokens([
      { role: 'tool', content: 'result', tool_call_id: 'call_123' },
    ])
    // should include the 1 token for tool_call_id
    expect(msg).toBeGreaterThan(5)
  })
})
