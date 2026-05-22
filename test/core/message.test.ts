import { describe, it, expect } from 'vitest'
import {
  systemMessage,
  userMessage,
  assistantMessage,
  toolResultMessage,
  defaultSystemPrompt,
  serializeMessages,
} from '../../src/core/message.js'

describe('message builders', () => {
  it('creates system message', () => {
    const msg = systemMessage('You are a helper')
    expect(msg).toEqual({ role: 'system', content: 'You are a helper' })
  })

  it('creates user message', () => {
    const msg = userMessage('Hello')
    expect(msg).toEqual({ role: 'user', content: 'Hello' })
  })

  it('creates assistant message with content only', () => {
    const msg = assistantMessage('Hi there')
    expect(msg).toEqual({ role: 'assistant', content: 'Hi there' })
    expect(msg.tool_calls).toBeUndefined()
  })

  it('creates assistant message with tool_calls', () => {
    const toolCalls = [
      {
        id: 'call_1',
        type: 'function' as const,
        function: { name: 'read', arguments: '{"path":"a.ts"}' },
      },
    ]
    const msg = assistantMessage(null, toolCalls)
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBeNull()
    expect(msg.tool_calls).toEqual(toolCalls)
  })

  it('creates assistant message with reasoning content', () => {
    const msg = assistantMessage(null, undefined, '思考内容')
    expect(msg).toEqual({ role: 'assistant', content: null, reasoning_content: '思考内容' })
  })

  it('creates tool result message with tool_call_id', () => {
    const msg = toolResultMessage('call_1', 'file content here')
    expect(msg).toEqual({
      role: 'tool',
      content: 'file content here',
      tool_call_id: 'call_1',
    })
  })
})


describe('defaultSystemPrompt', () => {
  it('builds a stable prompt with project instructions', () => {
    const prompt = defaultSystemPrompt({ cwd: '/repo', agentInstructions: 'Use pnpm.\n' })

    expect(prompt).toContain('You are ds-code')
    expect(prompt).toContain('Working directory: /repo')
    expect(prompt).toContain('Project instructions from AGENTS.md:\nUse pnpm.\n')
    expect(prompt.indexOf('Working directory')).toBeLessThan(prompt.indexOf('Project instructions'))
    expect(prompt.indexOf('Project instructions')).toBeLessThan(prompt.indexOf('You have tools'))
  })

  it('omits the project instructions block when empty', () => {
    const prompt = defaultSystemPrompt({ cwd: '/repo' })

    expect(prompt).not.toContain('Project instructions from AGENTS.md')
    expect(prompt).toContain('Working directory: /repo')
  })
})

describe('serializeMessages', () => {
  it('serializes all message types correctly', () => {
    const messages = [
      systemMessage('system prompt'),
      userMessage('hi'),
      assistantMessage(null, [
        { id: 'c1', type: 'function', function: { name: 'read', arguments: '{}' } },
      ], '需要读取文件'),
      toolResultMessage('c1', 'result'),
      assistantMessage('done'),
    ]

    const serialized = serializeMessages(messages)

    expect(serialized[0]).toEqual({ role: 'system', content: 'system prompt' })
    expect(serialized[1]).toEqual({ role: 'user', content: 'hi' })
    expect(serialized[2]!.role).toBe('assistant')
    expect(serialized[2]!.content).toBeNull()
    expect(serialized[2]!.tool_calls).toHaveLength(1)
    expect(serialized[2]!.reasoning_content).toBe('需要读取文件')
    expect(serialized[3]!.tool_call_id).toBe('c1')
    expect(serialized[4]).toEqual({ role: 'assistant', content: 'done' })
  })

  it('omits tool_calls and tool_call_id when not present', () => {
    const serialized = serializeMessages([userMessage('test')])
    expect(serialized[0]).toEqual({ role: 'user', content: 'test' })
    expect('tool_calls' in serialized[0]!).toBe(false)
    expect('tool_call_id' in serialized[0]!).toBe(false)
  })
})
