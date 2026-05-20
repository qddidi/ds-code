import { describe, it, expect, vi } from 'vitest'
import { Agent } from '../../src/core/agent.js'
import { ToolRegistry } from '../../src/tools/registry.js'
import type { DeepSeekClient, StreamCallbacks } from '../../src/api/deepseek.js'
import type { ChatMessage } from '../../src/api/types.js'
import type { Tool } from '../../src/tools/types.js'

function textMessage(content: string): ChatMessage {
  return { role: 'assistant', content }
}

function toolCallMessage(calls: { name: string; args: string; id?: string }[], reasoningContent?: string): ChatMessage {
  return {
    role: 'assistant',
    content: null,
    ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
    tool_calls: calls.map((c, i) => ({
      id: c.id ?? `call_${i}`,
      type: 'function' as const,
      function: { name: c.name, arguments: c.args },
    })),
  }
}

function createMockClient(responses: ChatMessage[]): DeepSeekClient {
  let callIndex = 0
  return {
    chatStream: vi.fn(async (_messages: ChatMessage[], callbacks: StreamCallbacks) => {
      const resp = responses[callIndex]!
      callIndex++
      if (resp.content) {
        callbacks.onContent?.(resp.content)
      }
      callbacks.onDone?.(resp)
      return resp
    }),
  } as unknown as DeepSeekClient
}

function createEchoTool(): Tool {
  return {
    name: 'echo',
    description: 'Echoes input',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
    requiresPermission: false,
    execute: async (params) => ({ content: `echo: ${params['text']}` }),
  }
}

function createFailingTool(): Tool {
  return {
    name: 'fail',
    description: 'Always fails',
    parameters: {
      type: 'object',
      properties: { msg: { type: 'string' } },
      required: ['msg'],
    },
    requiresPermission: false,
    execute: async () => { throw new Error('tool crashed') },
  }
}

describe('Agent', () => {
  it('returns text content from a simple response', async () => {
    const client = createMockClient([textMessage('Hello!')])
    const registry = new ToolRegistry()
    const agent = new Agent(client, registry)

    const result = await agent.run('Hi')
    expect(result).toBe('Hello!')
  })

  it('calls onContent callback for text response', async () => {
    const client = createMockClient([textMessage('World')])
    const registry = new ToolRegistry()
    const agent = new Agent(client, registry)

    const onContent = vi.fn()
    await agent.run('Hi', { onContent })
    expect(onContent).toHaveBeenCalledWith('World')
  })

  it('executes single tool call and returns final text', async () => {
    const client = createMockClient([
      toolCallMessage([{ name: 'echo', args: '{"text":"ping"}' }]),
      textMessage('Done'),
    ])
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const agent = new Agent(client, registry)

    const result = await agent.run('echo ping')
    expect(result).toBe('Done')

    const messages = agent.getMessages()
    const toolMsg = messages.find((m) => m.role === 'tool')
    expect(toolMsg?.content).toBe('echo: ping')
  })

  it('preserves reasoning content on tool-call assistant messages', async () => {
    const client = createMockClient([
      toolCallMessage([{ name: 'echo', args: '{"text":"ping"}', id: 'c1' }], '需要先查看工具结果'),
      textMessage('Done'),
    ])
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const agent = new Agent(client, registry)

    await agent.run('echo ping')

    const assistantToolMsg = agent.getMessages().find((m) => m.role === 'assistant' && m.tool_calls)
    expect(assistantToolMsg?.reasoning_content).toBe('需要先查看工具结果')
  })

  it('handles consecutive tool calls (2 rounds)', async () => {
    const client = createMockClient([
      toolCallMessage([{ name: 'echo', args: '{"text":"first"}', id: 'c1' }]),
      toolCallMessage([{ name: 'echo', args: '{"text":"second"}', id: 'c2' }]),
      textMessage('All done'),
    ])
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const agent = new Agent(client, registry)

    const result = await agent.run('do two things')
    expect(result).toBe('All done')

    const toolMessages = agent.getMessages().filter((m) => m.role === 'tool')
    expect(toolMessages).toHaveLength(2)
    expect(toolMessages[0]!.content).toBe('echo: first')
    expect(toolMessages[1]!.content).toBe('echo: second')
  })

  it('handles parallel tool calls (multiple in one response)', async () => {
    const client = createMockClient([
      toolCallMessage([
        { name: 'echo', args: '{"text":"a"}', id: 'c1' },
        { name: 'echo', args: '{"text":"b"}', id: 'c2' },
      ]),
      textMessage('Both done'),
    ])
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const agent = new Agent(client, registry)

    const result = await agent.run('parallel')
    expect(result).toBe('Both done')

    const toolMessages = agent.getMessages().filter((m) => m.role === 'tool')
    expect(toolMessages).toHaveLength(2)
    expect(toolMessages[0]!.tool_call_id).toBe('c1')
    expect(toolMessages[1]!.tool_call_id).toBe('c2')
  })

  it('stops at maxIterations and returns error', async () => {
    const infiniteToolCalls = Array.from({ length: 5 }, () =>
      toolCallMessage([{ name: 'echo', args: '{"text":"loop"}' }]),
    )
    const client = createMockClient(infiniteToolCalls)
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const agent = new Agent(client, registry, { maxIterations: 3 })

    const onMaxIterations = vi.fn()
    const result = await agent.run('loop forever', { onMaxIterations })

    expect(result).toContain('Exceeded maximum iterations')
    expect(onMaxIterations).toHaveBeenCalled()
  })

  it('handles tool execution failure gracefully', async () => {
    const client = createMockClient([
      toolCallMessage([{ name: 'fail', args: '{"msg":"x"}', id: 'c1' }]),
      textMessage('Handled error'),
    ])
    const registry = new ToolRegistry()
    registry.register(createFailingTool())
    const agent = new Agent(client, registry)

    const onToolResult = vi.fn()
    const result = await agent.run('break it', { onToolResult })

    expect(result).toBe('Handled error')
    expect(onToolResult).toHaveBeenCalledWith('fail', 'tool crashed', true)

    const toolMsg = agent.getMessages().find((m) => m.role === 'tool')
    expect(toolMsg?.content).toBe('tool crashed')
  })

  it('accumulates message history across multiple runs', async () => {
    const client = createMockClient([
      textMessage('First reply'),
      textMessage('Second reply'),
    ])
    const registry = new ToolRegistry()
    const agent = new Agent(client, registry)

    await agent.run('Hello')
    await agent.run('Again')

    const messages = agent.getMessages()
    expect(messages.filter((m) => m.role === 'user')).toHaveLength(2)
    expect(messages.filter((m) => m.role === 'assistant')).toHaveLength(2)
  })
})
