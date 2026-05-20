import type { ChatMessage } from '../api/types.js'
import type { DeepSeekClient } from '../api/deepseek.js'
import type { ToolRegistry } from '../tools/registry.js'
import { ContextManager } from './context.js'
import { systemMessage, userMessage, assistantMessage, toolResultMessage } from './message.js'

export interface AgentConfig {
  systemPrompt: string
  maxIterations: number
  maxContextTokens: number
}

export interface AgentCallbacks {
  onContent?: (text: string) => void
  onThinking?: (text: string) => void
  onToolCall?: (name: string, args: string) => void
  onToolResult?: (name: string, result: string, isError: boolean) => void
  onMaxIterations?: () => void
  onCompressing?: () => void
}

const DEFAULT_CONFIG: AgentConfig = {
  systemPrompt: 'You are a helpful coding assistant.',
  maxIterations: 20,
  maxContextTokens: 64000,
}

export class Agent {
  private client: DeepSeekClient
  private registry: ToolRegistry
  private config: AgentConfig
  private messages: ChatMessage[] = []
  private contextManager: ContextManager

  constructor(
    client: DeepSeekClient,
    registry: ToolRegistry,
    config: Partial<AgentConfig> = {},
  ) {
    this.client = client
    this.registry = registry
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.messages = [systemMessage(this.config.systemPrompt)]
    this.contextManager = new ContextManager({
      maxTokens: this.config.maxContextTokens,
    })
    this.contextManager.addMessage(this.messages[0]!)
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  loadMessages(messages: ChatMessage[]): void {
    this.messages = [...messages]
    this.contextManager = new ContextManager({
      maxTokens: this.config.maxContextTokens,
    })
    for (const msg of this.messages) {
      this.contextManager.addMessage(msg)
    }
  }

  resetMessages(): void {
    this.messages = [systemMessage(this.config.systemPrompt)]
    this.contextManager = new ContextManager({
      maxTokens: this.config.maxContextTokens,
    })
    this.contextManager.addMessage(this.messages[0]!)
  }

  async compressNow(): Promise<boolean> {
    if (this.messages.length <= 2) return false
    await this.contextManager.compress(async (msgs) => {
      const summaryResponse = await this.client.chatStream(
        [
          systemMessage('Summarize the following conversation concisely, preserving key decisions, file paths, and context needed to continue the work.'),
          userMessage(msgs.map((m) => `[${m.role}]: ${m.content ?? ''}`).join('\n')),
        ],
        {},
      )
      return summaryResponse.content ?? ''
    })
    this.messages = this.contextManager.getMessages()
    return true
  }

  async run(input: string, callbacks: AgentCallbacks = {}, signal?: AbortSignal): Promise<string> {
    const userMsg = userMessage(input)
    this.messages.push(userMsg)
    this.contextManager.addMessage(userMsg)

    if (this.contextManager.shouldCompress()) {
      callbacks.onCompressing?.()
      await this.contextManager.compress(async (msgs) => {
        const summaryResponse = await this.client.chatStream(
          [
            systemMessage('Summarize the following conversation concisely, preserving key decisions, file paths, and context needed to continue the work.'),
            userMessage(msgs.map((m) => `[${m.role}]: ${m.content ?? ''}`).join('\n')),
          ],
          {},
        )
        return summaryResponse.content ?? ''
      })
      this.messages = this.contextManager.getMessages()
    }

    let iterations = 0

    while (iterations < this.config.maxIterations) {
      if (signal?.aborted) {
        return ''
      }

      iterations++

      const message = await this.client.chatStream(
        this.messages,
        {
          onContent: (chunk) => { callbacks.onContent?.(chunk) },
          onThinking: (chunk) => { callbacks.onThinking?.(chunk) },
        },
        this.registry.toToolDefinitions(),
        signal,
      )

      const assistantMsg = assistantMessage(message.content, message.tool_calls, message.reasoning_content)
      this.messages.push(assistantMsg)
      this.contextManager.addMessage(assistantMsg)

      if (!message.tool_calls || message.tool_calls.length === 0) {
        return message.content ?? ''
      }

      const toolResults: ChatMessage[] = []

      for (const toolCall of message.tool_calls) {
        if (signal?.aborted) {
          return ''
        }

        callbacks.onToolCall?.(toolCall.function.name, toolCall.function.arguments)

        const result = await this.registry.execute(
          toolCall.function.name,
          toolCall.function.arguments,
          signal,
        )

        callbacks.onToolResult?.(
          toolCall.function.name,
          result.content,
          result.isError ?? false,
        )

        const toolMsg = toolResultMessage(toolCall.id, result.content)
        toolResults.push(toolMsg)
        this.contextManager.addMessage(toolMsg)
      }

      this.messages.push(...toolResults)
    }

    callbacks.onMaxIterations?.()
    return `Error: Exceeded maximum iterations (${this.config.maxIterations})`
  }
}
