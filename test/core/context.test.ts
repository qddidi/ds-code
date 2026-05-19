import { describe, it, expect, vi } from 'vitest'
import { ContextManager } from '../../src/core/context.js'
import { assistantMessage, systemMessage, userMessage } from '../../src/core/message.js'

describe('ContextManager', () => {
  it('tracks total tokens as messages are added', () => {
    const context = new ContextManager({ maxTokens: 1000 })
    const initial = context.getTotalTokens()

    context.addMessage(userMessage('hello world'))
    const afterFirst = context.getTotalTokens()
    context.addMessage(assistantMessage('response text'))

    expect(afterFirst).toBeGreaterThan(initial)
    expect(context.getTotalTokens()).toBeGreaterThan(afterFirst)
  })

  it('returns true when token usage exceeds threshold', () => {
    const context = new ContextManager({ maxTokens: 30, compressionThreshold: 0.8 })

    context.addMessage(userMessage('this is a long message that should cross the threshold quickly'))

    expect(context.shouldCompress()).toBe(true)
  })

  it('does not compress below threshold', () => {
    const context = new ContextManager({ maxTokens: 1000, compressionThreshold: 0.8 })

    context.addMessage(userMessage('short'))

    expect(context.shouldCompress()).toBe(false)
  })

  it('compresses old messages into a summary', async () => {
    const context = new ContextManager({ maxTokens: 100, preserveRecentMessages: 2 })
    context.addMessage(systemMessage('system prompt'))
    context.addMessage(userMessage('old question'))
    context.addMessage(assistantMessage('old answer'))
    context.addMessage(userMessage('recent question'))
    context.addMessage(assistantMessage('recent answer'))

    const summarize = vi.fn(async () => 'old question and answer')
    await context.compress(summarize)

    const messages = context.getMessages()
    expect(summarize).toHaveBeenCalledWith([
      userMessage('old question'),
      assistantMessage('old answer'),
    ])
    expect(messages).toHaveLength(4)
    expect(messages[1]?.content).toContain('old question and answer')
  })

  it('preserves system messages during compression', async () => {
    const context = new ContextManager({ maxTokens: 100, preserveRecentMessages: 1 })
    context.addMessage(systemMessage('system prompt'))
    context.addMessage(userMessage('old question'))
    context.addMessage(assistantMessage('recent answer'))

    await context.compress(async () => 'summary')

    const messages = context.getMessages()
    expect(messages[0]).toEqual(systemMessage('system prompt'))
    expect(messages.some((message) => message.role === 'system' && message.content?.includes('summary'))).toBe(true)
  })

  it('preserves recent messages during compression', async () => {
    const context = new ContextManager({ maxTokens: 100, preserveRecentMessages: 2 })
    context.addMessage(userMessage('old'))
    context.addMessage(assistantMessage('old answer'))
    context.addMessage(userMessage('recent question'))
    context.addMessage(assistantMessage('recent answer'))

    await context.compress(async () => 'summary')

    const messages = context.getMessages()
    expect(messages.at(-2)).toEqual(userMessage('recent question'))
    expect(messages.at(-1)).toEqual(assistantMessage('recent answer'))
  })
})
