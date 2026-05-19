import {
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ChatMessage,
  type DeepSeekClientConfig,
  type StreamChunk,
  type ToolCall,
  type ToolDefinition,
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
} from './types.js'
import { parseSSEStream } from './stream.js'

const DEFAULT_CONFIG: DeepSeekClientConfig = {
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-pro',
  maxTokens: 8192,
  temperature: 0,
  timeout: 60000,
}

export type DeepSeekModel = 'deepseek-v4-pro' | 'deepseek-v4-flash' | 'deepseek-reasoner'

const AVAILABLE_MODELS = 'deepseek-v4-pro, deepseek-v4-flash, deepseek-reasoner'

export function normalizeModel(model: string): DeepSeekModel | null {
  if (model === 'pro' || model === 'chat' || model === 'deepseek-chat' || model === 'deepseek-v4-pro') return 'deepseek-v4-pro'
  if (model === 'flash' || model === 'deepseek-v4-flash') return 'deepseek-v4-flash'
  if (model === 'reasoner' || model === 'deepseek-reasoner') return 'deepseek-reasoner'
  return null
}

export function supportsTools(model: string): boolean {
  const normalized = normalizeModel(model)
  return normalized === 'deepseek-v4-pro' || normalized === 'deepseek-v4-flash'
}

export interface StreamCallbacks {
  onContent?: (text: string) => void
  onToolCall?: (toolCall: ToolCall) => void
  onDone?: (message: ChatMessage) => void
  onError?: (error: Error) => void
}

export class DeepSeekClient {
  private config: DeepSeekClientConfig

  constructor(config: Partial<DeepSeekClientConfig> & { apiKey: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    const model = normalizeModel(this.config.model)
    if (!model) {
      throw new Error(`Invalid model. Available models: ${AVAILABLE_MODELS}`)
    }
    this.config.model = model
  }

  getModel(): DeepSeekModel {
    return this.config.model as DeepSeekModel
  }

  setModel(modelName: string): DeepSeekModel {
    const model = normalizeModel(modelName)
    if (!model) {
      throw new Error(`Invalid model. Available models: ${AVAILABLE_MODELS}`)
    }
    this.config.model = model
    return model
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
  ): Promise<ChatCompletionResponse> {
    const body: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false,
    }

    if (supportsTools(this.config.model) && tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const response = await this.fetch(body)
    return normalizeReasonerResponse(response as ChatCompletionResponse)
  }

  async chatStream(
    messages: ChatMessage[],
    callbacks: StreamCallbacks,
    tools?: ToolDefinition[],
  ): Promise<ChatMessage> {
    const body: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    }

    if (supportsTools(this.config.model) && tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const response = await this.fetchRaw(body)
    return this.processStream(response, callbacks)
  }

  private async processStream(
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<ChatMessage> {
    let content = ''
    const toolCalls: Map<number, ToolCall> = new Map()

    for await (const event of parseSSEStream(response)) {
      if (event.type === 'error') {
        callbacks.onError?.(event.error)
        throw event.error
      }

      if (event.type === 'done') break

      if (event.type === 'chunk') {
        const chunk: StreamChunk = event.data
        const delta = chunk.choices[0]?.delta

        if (delta?.content) {
          content += delta.content
          callbacks.onContent?.(delta.content)
        }

        if (delta?.reasoning_content) {
          content += delta.reasoning_content
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCalls.get(tc.index)
            if (existing) {
              if (tc.function?.arguments) {
                existing.function.arguments += tc.function.arguments
              }
            } else {
              toolCalls.set(tc.index, {
                id: tc.id ?? '',
                type: 'function',
                function: {
                  name: tc.function?.name ?? '',
                  arguments: tc.function?.arguments ?? '',
                },
              })
            }
          }
        }
      }
    }

    const message: ChatMessage = {
      role: 'assistant',
      content: content || null,
    }

    if (toolCalls.size > 0) {
      message.tool_calls = [...toolCalls.values()]
      for (const tc of message.tool_calls) {
        callbacks.onToolCall?.(tc)
      }
    }

    callbacks.onDone?.(message)
    return message
  }

  private async fetch(body: ChatCompletionRequest): Promise<unknown> {
    const response = await this.fetchRaw(body)
    return response.json()
  }

  private async fetchRaw(body: ChatCompletionRequest): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/chat/completions`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    let response: Response
    try {
      response = await globalThis.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NetworkError('Request timed out')
      }
      throw new NetworkError(
        err instanceof Error ? err.message : 'Network request failed',
      )
    } finally {
      clearTimeout(timeoutId)
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '')
      if (response.status === 401) {
        throw new AuthenticationError()
      }
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after')
        throw new RateLimitError(retryAfter ? parseInt(retryAfter, 10) : null)
      }
      throw new ApiError(
        `API request failed with status ${response.status}${responseBody ? `: ${responseBody}` : ''}`,
        response.status,
        responseBody,
      )
    }

    return response
  }
}

function normalizeReasonerResponse(response: ChatCompletionResponse): ChatCompletionResponse {
  for (const choice of response.choices) {
    if (choice.message.reasoning_content && !choice.message.content) {
      choice.message.content = choice.message.reasoning_content
    }
  }
  return response
}
