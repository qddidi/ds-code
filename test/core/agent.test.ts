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

function createEchoTool(name = 'echo'): Tool {
  return {
    name,
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

  it('reuses tool definitions across loop iterations', async () => {
    const client = createMockClient([
      toolCallMessage([{ name: 'echo', args: '{"text":"first"}', id: 'c1' }]),
      toolCallMessage([{ name: 'echo', args: '{"text":"second"}', id: 'c2' }]),
      textMessage('Done'),
    ])
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const toToolDefinitions = vi.spyOn(registry, 'toToolDefinitions')
    const agent = new Agent(client, registry)

    await agent.run('do two things')

    expect(toToolDefinitions).toHaveBeenCalledTimes(1)
    const chatStream = vi.mocked(client.chatStream)
    expect(chatStream.mock.calls[0]?.[2]).toBe(chatStream.mock.calls[1]?.[2])
    expect(chatStream.mock.calls[1]?.[2]).toBe(chatStream.mock.calls[2]?.[2])
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
        { name: 'read_file', args: '{"text":"a"}', id: 'c1' },
        { name: 'grep', args: '{"text":"b"}', id: 'c2' },
      ]),
      textMessage('Both done'),
    ])
    const registry = new ToolRegistry()
    registry.register(createEchoTool('read_file'))
    registry.register(createEchoTool('grep'))
    const agent = new Agent(client, registry)

    const result = await agent.run('parallel')
    expect(result).toBe('Both done')

    const toolMessages = agent.getMessages().filter((m) => m.role === 'tool')
    expect(toolMessages).toHaveLength(2)
    expect(toolMessages[0]!.tool_call_id).toBe('c1')
    expect(toolMessages[1]!.tool_call_id).toBe('c2')
  })

  it('executes tools marked read-only by metadata in parallel', async () => {
    const client = createMockClient([
      toolCallMessage([
        { name: 'custom_read_a', args: '{"text":"a"}', id: 'c1' },
        { name: 'custom_read_b', args: '{"text":"b"}', id: 'c2' },
      ]),
      textMessage('Both done'),
    ])
    const registry = new ToolRegistry()
    const finishOrder: string[] = []
    registry.register({
      ...createEchoTool('custom_read_a'),
      execute: async (params) => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        finishOrder.push('custom_read_a')
        return { content: `echo: ${params['text']}` }
      },
    })
    registry.register({
      ...createEchoTool('custom_read_b'),
      execute: async (params) => {
        finishOrder.push('custom_read_b')
        return { content: `echo: ${params['text']}` }
      },
    })
    const agent = new Agent(client, registry)

    const result = await agent.run('parallel custom read-only tools')

    expect(result).toBe('Both done')
    expect(finishOrder).toEqual(['custom_read_b', 'custom_read_a'])
    const toolMessages = agent.getMessages().filter((m) => m.role === 'tool')
    expect(toolMessages.map((m) => m.tool_call_id)).toEqual(['c1', 'c2'])
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

  it('uses unlimited tool-call iterations by default', async () => {
    const responses = Array.from({ length: 60 }, (_, index) =>
      toolCallMessage([{ name: 'echo', args: `{"text":"loop-${index}"}` }]),
    )
    responses.push(textMessage('Done'))
    const client = createMockClient(responses)
    const registry = new ToolRegistry()
    registry.register(createEchoTool())
    const agent = new Agent(client, registry)

    const onMaxIterations = vi.fn()
    const result = await agent.run('keep going', { onMaxIterations })

    expect(result).toBe('Done')
    expect(onMaxIterations).not.toHaveBeenCalled()
    expect(vi.mocked(client.chatStream)).toHaveBeenCalledTimes(61)
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

  it('includes tool calls when summarizing compressed context', async () => {
    const client = createMockClient([
      { role: 'assistant', content: 'summary' },
    ])
    const registry = new ToolRegistry()
    const agent = new Agent(client, registry)
    agent.loadMessages([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'inspect' },
      toolCallMessage([{ name: 'read_file', args: '{"file_path":"src/index.ts"}', id: 'c1' }]),
      { role: 'tool', content: 'file content', tool_call_id: 'c1' },
      { role: 'assistant', content: 'done' },
      { role: 'user', content: 'next' },
      { role: 'assistant', content: 'next done' },
      { role: 'user', content: 'another' },
      { role: 'assistant', content: 'another done' },
    ])

    await agent.compressNow()

    const chatStream = vi.mocked(client.chatStream)
    const summaryMessages = chatStream.mock.calls[0]![0]
    expect(summaryMessages[1]?.content).toContain('tool_calls=')
    expect(summaryMessages[1]?.content).toContain('src/index.ts')
    expect(summaryMessages[1]?.content).toContain('tool_call_id=c1')
  })
})
