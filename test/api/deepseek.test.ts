import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeepSeekClient } from '../../src/api/deepseek.js'
import {
  AuthenticationError,
  RateLimitError,
  NetworkError,
} from '../../src/api/types.js'

function mockFetchResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response)
}

function mockStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  let index = 0

  const readable = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!))
        index++
      } else {
        controller.close()
      }
    },
  })

  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    body: readable,
  } as unknown as Response)
}

const SAMPLE_RESPONSE = {
  id: 'chatcmpl-123',
  object: 'chat.completion',
  created: 1700000000,
  model: 'deepseek-chat',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: 'Hello!',
      },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}

const TOOL_CALL_RESPONSE = {
  id: 'chatcmpl-456',
  object: 'chat.completion',
  created: 1700000000,
  model: 'deepseek-chat',
  choices: [
    {
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_abc',
            type: 'function',
            function: {
              name: 'read_file',
              arguments: '{"path":"/tmp/test.ts"}',
            },
          },
        ],
      },
      finish_reason: 'tool_calls',
    },
  ],
  usage: { prompt_tokens: 20, completion_tokens: 15, total_tokens: 35 },
}

describe('DeepSeekClient', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('chat (non-streaming)', () => {
    it('sends correct request and parses response', async () => {
      const fetchMock = mockFetchResponse(SAMPLE_RESPONSE)
      globalThis.fetch = fetchMock

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const result = await client.chat([{ role: 'user', content: 'Hi' }])

      expect(result.choices[0]!.message.content).toBe('Hello!')
      expect(result.usage.total_tokens).toBe(15)

      const [url, options] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://api.deepseek.com/v1/chat/completions')
      expect(options.headers['Authorization']).toBe('Bearer sk-test')
      expect(options.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(options.body)
      expect(body.model).toBe('deepseek-v4-pro')
      expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }])
      expect(body.stream).toBe(false)
    })

    it('parses tool_calls in response', async () => {
      globalThis.fetch = mockFetchResponse(TOOL_CALL_RESPONSE)

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const result = await client.chat([{ role: 'user', content: 'read file' }])

      const toolCalls = result.choices[0]!.message.tool_calls!
      expect(toolCalls).toHaveLength(1)
      expect(toolCalls[0]!.function.name).toBe('read_file')
      expect(JSON.parse(toolCalls[0]!.function.arguments)).toEqual({ path: '/tmp/test.ts' })
    })

    it('passes tools in request body', async () => {
      const fetchMock = mockFetchResponse(SAMPLE_RESPONSE)
      globalThis.fetch = fetchMock

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'read_file',
            description: 'Read a file',
            parameters: { type: 'object', properties: { path: { type: 'string' } } },
          },
        },
      ]

      await client.chat([{ role: 'user', content: 'Hi' }], tools)

      const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
      expect(body.tools).toEqual(tools)
      expect(body.tool_choice).toBe('auto')
    })
  })

  describe('error handling', () => {
    it('throws AuthenticationError on 401', async () => {
      globalThis.fetch = mockFetchResponse({ error: 'unauthorized' }, 401)

      const client = new DeepSeekClient({ apiKey: 'bad-key' })
      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(AuthenticationError)
    })

    it('throws RateLimitError on 429 with retry-after', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '30' }),
        text: () => Promise.resolve('rate limited'),
      } as unknown as Response)

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      try {
        await client.chat([{ role: 'user', content: 'Hi' }])
        expect.fail('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitError)
        expect((err as RateLimitError).retryAfter).toBe(30)
      }
    })

    it('does not attach a timeout timer by default', async () => {
      const fetchMock = mockFetchResponse(SAMPLE_RESPONSE)
      globalThis.fetch = fetchMock
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      await client.chat([{ role: 'user', content: 'Hi' }])

      expect(setTimeoutSpy).not.toHaveBeenCalled()
      setTimeoutSpy.mockRestore()
    })

    it('throws NetworkError on timeout when timeout is configured', async () => {
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const err = new Error('aborted')
        err.name = 'AbortError'
        return Promise.reject(err)
      })

      const client = new DeepSeekClient({ apiKey: 'sk-test', timeout: 100 })
      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(NetworkError)
    })

    it('throws NetworkError on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      await expect(client.chat([{ role: 'user', content: 'Hi' }]))
        .rejects.toThrow(NetworkError)
    })
  })

  describe('chatStream', () => {
    it('streams content chunks and assembles final message', async () => {
      const sseChunks = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]

      globalThis.fetch = mockStreamResponse(sseChunks)

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const contentParts: string[] = []

      const message = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        { onContent: (text) => contentParts.push(text) },
      )

      expect(contentParts).toEqual(['Hello', ' world'])
      expect(message.role).toBe('assistant')
      expect(message.content).toBe('Hello world')
    })

    it('streams tool calls and assembles them', async () => {
      const sseChunks = [
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"read_file","arguments":""}}]},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"path\\""}}]},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":":\\"/tmp/a.ts\\"}"}}]},"finish_reason":null}]}\n\n',
        'data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
        'data: [DONE]\n\n',
      ]

      globalThis.fetch = mockStreamResponse(sseChunks)

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const toolCalls: unknown[] = []

      const message = await client.chatStream(
        [{ role: 'user', content: 'read' }],
        { onToolCall: (tc) => toolCalls.push(tc) },
      )

      expect(message.tool_calls).toHaveLength(1)
      expect(message.tool_calls![0]!.id).toBe('call_1')
      expect(message.tool_calls![0]!.function.name).toBe('read_file')
      expect(JSON.parse(message.tool_calls![0]!.function.arguments)).toEqual({ path: '/tmp/a.ts' })
      expect(toolCalls).toHaveLength(1)
    })

    it('calls onError when stream is interrupted before any response', async () => {
      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('connection reset'))
        },
      })

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: readable,
      } as unknown as Response)

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const errors: Error[] = []

      await expect(
        client.chatStream(
          [{ role: 'user', content: 'Hi' }],
          { onError: (err) => errors.push(err) },
        ),
      ).rejects.toThrow('connection reset')

      expect(errors).toHaveLength(1)
      expect(errors[0]!.message).toBe('connection reset')
    })

    it('returns partial content when stream is interrupted after content started', async () => {
      const encoder = new TextEncoder()
      let delivered = false
      const readable = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (!delivered) {
            delivered = true
            controller.enqueue(encoder.encode('data: {"id":"1","object":"chat.completion.chunk","created":1,"model":"deepseek-chat","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\n'))
            return
          }
          controller.error(new Error('connection reset'))
        },
      })

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        body: readable,
      } as unknown as Response)

      const client = new DeepSeekClient({ apiKey: 'sk-test' })
      const errors: Error[] = []

      const message = await client.chatStream(
        [{ role: 'user', content: 'Hi' }],
        { onError: (err) => errors.push(err) },
      )

      expect(message.content).toBe('Hi')
      expect(errors).toHaveLength(1)
      expect(errors[0]!.message).toBe('connection reset')
    })
  })
})
