import {
  type ChatClientConfig,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ChatMessage,
  type DeepSeekClientConfig,
  type Provider,
  type StreamChunk,
  type ToolCall,
  type ToolDefinition,
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
} from './types.js'
import { parseSSEStream } from './stream.js'
import { withRetry } from './retry.js'

const DEFAULT_CONFIG: ChatClientConfig = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-v4-pro',
  maxTokens: 16384,
  temperature: 0,
  timeout: 60000,
}

export type DeepSeekModel = 'deepseek-v4-pro' | 'deepseek-v4-flash' | 'deepseek-reasoner'
export type ChatModel = DeepSeekModel | string

export const AVAILABLE_MODELS: DeepSeekModel[] = ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-reasoner']

export function normalizeProvider(provider: string | undefined): Provider {
  if (!provider) return 'deepseek'
  if (provider === 'deepseek' || provider === 'openai' || provider === 'custom') {
    return provider
  }
  throw new Error('Invalid provider. Available providers: deepseek, openai, custom')
}

export function normalizeModel(model: string, provider: Provider = 'deepseek'): string | null {
  const trimmed = model.trim()
  if (!trimmed) return null
  if (provider !== 'deepseek') return trimmed
  if (trimmed === 'pro' || trimmed === 'chat' || trimmed === 'deepseek-chat' || trimmed === 'deepseek-v4-pro') return 'deepseek-v4-pro'
  if (trimmed === 'flash' || trimmed === 'deepseek-v4-flash') return 'deepseek-v4-flash'
  if (trimmed === 'reasoner' || trimmed === 'deepseek-reasoner') return 'deepseek-reasoner'
  return null
}

export function supportsTools(model: string, provider: Provider = 'deepseek'): boolean {
  if (provider !== 'deepseek') return true
  const normalized = normalizeModel(model, provider)
  return normalized === 'deepseek-v4-pro' || normalized === 'deepseek-v4-flash'
}

export interface StreamCallbacks {
  onContent?: (text: string) => void
  onThinking?: (text: string) => void
  onToolCallStart?: () => void
  onToolCall?: (toolCall: ToolCall) => void
  onDone?: (message: ChatMessage) => void
  onError?: (error: Error) => void
}

export class DeepSeekClient {
  private config: ChatClientConfig

  constructor(config: Partial<DeepSeekClientConfig> & { apiKey: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.config.provider = normalizeProvider(this.config.provider)
    const model = normalizeModel(this.config.model, this.config.provider)
    if (!model) {
      throw new Error(modelErrorMessage(this.config.provider))
    }
    this.config.model = model
  }

  getProvider(): Provider {
    return this.config.provider
  }

  getBaseUrl(): string {
    return this.config.baseUrl
  }

  getModel(): string {
    return this.config.model
  }

  setModel(modelName: string): string {
    const model = normalizeModel(modelName, this.config.provider)
    if (!model) {
      throw new Error(modelErrorMessage(this.config.provider))
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

    if (supportsTools(this.config.model, this.config.provider) && tools && tools.length > 0) {
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
    signal?: AbortSignal,
  ): Promise<ChatMessage> {
    const body: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true,
    }

    if (supportsTools(this.config.model, this.config.provider) && tools && tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const response = await withRetry(() => this.fetchRaw(body, signal))
    return this.processStream(response, callbacks)
  }

  private async processStream(
    response: Response,
    callbacks: StreamCallbacks,
  ): Promise<ChatMessage> {
    let content = ''
    let reasoningContent = ''
    let finishReason: string | null = null
    const toolCalls: Map<number, ToolCall> = new Map()

    for await (const event of parseSSEStream(response)) {
      if (event.type === 'error') {
        callbacks.onError?.(event.error)
        throw event.error
      }

      if (event.type === 'done') break

      if (event.type === 'chunk') {
        const chunk: StreamChunk = event.data
        const choice = chunk.choices[0]
        const delta = choice?.delta

        if (choice?.finish_reason) {
          finishReason = choice.finish_reason
        }

        if (delta?.content) {
          content += delta.content
          callbacks.onContent?.(delta.content)
        }

        if (delta?.reasoning_content) {
          reasoningContent += delta.reasoning_content
          callbacks.onThinking?.(delta.reasoning_content)
        }

        if (delta?.tool_calls) {
          if (toolCalls.size === 0) {
            callbacks.onToolCallStart?.()
          }
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
      finish_reason: finishReason,
    }

    if (reasoningContent) {
      message.reasoning_content = reasoningContent
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

  private async fetchRaw(body: ChatCompletionRequest, externalSignal?: AbortSignal): Promise<Response> {
    const url = `${this.config.baseUrl}/v1/chat/completions`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    const onExternalAbort = (): void => { controller.abort() }
    if (externalSignal) {
      if (externalSignal.aborted) {
        clearTimeout(timeoutId)
        throw new NetworkError('Request aborted')
      }
      externalSignal.addEventListener('abort', onExternalAbort)
    }

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
      externalSignal?.removeEventListener('abort', onExternalAbort)
      if (externalSignal?.aborted) {
        throw new NetworkError('Request aborted')
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new NetworkError('Request timed out')
      }
      throw new NetworkError(
        err instanceof Error ? err.message : 'Network request failed',
      )
    } finally {
      clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', onExternalAbort)
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

function modelErrorMessage(provider: Provider): string {
  if (provider === 'deepseek') {
    return `Invalid model. Available models: ${AVAILABLE_MODELS.join(', ')}`
  }
  return 'Invalid model. Model must be a non-empty string.'
}

function normalizeReasonerResponse(response: ChatCompletionResponse): ChatCompletionResponse {
  for (const choice of response.choices) {
    if (choice.message.reasoning_content && !choice.message.content) {
      choice.message.content = choice.message.reasoning_content
    }
  }
  return response
}
