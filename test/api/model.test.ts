import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DeepSeekClient, normalizeModel, supportsTools } from '../../src/api/deepseek.js'
import { modelCommand, resolveModelCommand } from '../../src/cli/model.js'

function mockFetchResponse(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response)
}

const REASONER_RESPONSE = {
  id: 'chatcmpl-r1',
  object: 'chat.completion',
  created: 1700000000,
  model: 'deepseek-reasoner',
  choices: [{
    index: 0,
    message: {
      role: 'assistant',
      content: null,
      reasoning_content: 'reasoned answer',
    },
    finish_reason: 'stop',
  }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}

describe('model support', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('uses deepseek-v4-pro by default', () => {
    const client = new DeepSeekClient({ apiKey: 'sk-test' })

    expect(client.getModel()).toBe('deepseek-v4-pro')
  })

  it('switches model from command aliases', () => {
    const client = new DeepSeekClient({ apiKey: 'sk-test' })

    const model = client.setModel('reasoner')

    expect(model).toBe('deepseek-reasoner')
    expect(client.getModel()).toBe('deepseek-reasoner')
    expect(modelCommand('/model pro')).toBe('deepseek-v4-pro')
    expect(modelCommand('/model flash')).toBe('deepseek-v4-flash')
    expect(resolveModelCommand('/model reasoner')).toEqual({
      ok: true,
      model: 'deepseek-reasoner',
      message: 'Switched to: deepseek-reasoner',
    })
  })

  it('extracts reasoning_content into content when needed', async () => {
    globalThis.fetch = mockFetchResponse(REASONER_RESPONSE)
    const client = new DeepSeekClient({ apiKey: 'sk-test', model: 'deepseek-reasoner' })

    const response = await client.chat([{ role: 'user', content: 'think' }])

    expect(response.choices[0]?.message.reasoning_content).toBe('reasoned answer')
    expect(response.choices[0]?.message.content).toBe('reasoned answer')
  })

  it('sends tools for v4 pro and flash models', async () => {
    const fetchMock = mockFetchResponse(REASONER_RESPONSE)
    globalThis.fetch = fetchMock
    const client = new DeepSeekClient({ apiKey: 'sk-test', model: 'flash' })

    await client.chat([{ role: 'user', content: 'hi' }], [{
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file',
        parameters: { type: 'object', properties: {} },
      },
    }])

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.model).toBe('deepseek-v4-flash')
    expect(body.tools).toBeDefined()
    expect(supportsTools('deepseek-v4-pro')).toBe(true)
    expect(supportsTools('deepseek-v4-flash')).toBe(true)
  })

  it('does not send tools for reasoner model', async () => {
    const fetchMock = mockFetchResponse(REASONER_RESPONSE)
    globalThis.fetch = fetchMock
    const client = new DeepSeekClient({ apiKey: 'sk-test', model: 'reasoner' })

    await client.chat([{ role: 'user', content: 'hi' }], [{
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file',
        parameters: { type: 'object', properties: {} },
      },
    }])

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body)
    expect(body.model).toBe('deepseek-reasoner')
    expect(body.tools).toBeUndefined()
    expect(body.tool_choice).toBeUndefined()
  })

  it('supports OpenAI and custom model names', async () => {
    const fetchMock = mockFetchResponse(REASONER_RESPONSE)
    globalThis.fetch = fetchMock
    const client = new DeepSeekClient({
      provider: 'custom',
      apiKey: 'sk-relay',
      baseUrl: 'https://relay.example.com',
      model: 'openai/gpt-4o',
    })

    await client.chat([{ role: 'user', content: 'hi' }], [{
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read file',
        parameters: { type: 'object', properties: {} },
      },
    }])

    const [url, options] = fetchMock.mock.calls[0]!
    const body = JSON.parse(options.body)
    expect(client.getProvider()).toBe('custom')
    expect(client.getBaseUrl()).toBe('https://relay.example.com')
    expect(body.model).toBe('openai/gpt-4o')
    expect(body.tools).toBeDefined()
    expect(url).toBe('https://relay.example.com/v1/chat/completions')
    expect(supportsTools('gpt-4o', 'openai')).toBe(true)
    expect(normalizeModel('gpt-4o', 'openai')).toBe('gpt-4o')
    expect(resolveModelCommand('/model gpt-4o', 'openai')).toEqual({
      ok: true,
      model: 'gpt-4o',
      message: 'Switched to: gpt-4o',
    })
  })

  it('reports invalid model names with available models', () => {
    expect(normalizeModel('bad-model')).toBeNull()
    expect(supportsTools('deepseek-reasoner')).toBe(false)
    expect(() => new DeepSeekClient({ apiKey: 'sk-test', model: 'bad-model' })).toThrow(
      'Available models',
    )
    expect(modelCommand('/model bad')).toContain('Available models')
  })
})
