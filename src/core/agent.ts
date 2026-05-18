import type { ChatMessage } from '../api/types.js'
import type { DeepSeekClient } from '../api/deepseek.js'
import type { ToolRegistry } from '../tools/registry.js'
import { systemMessage, userMessage, assistantMessage, toolResultMessage } from './message.js'

export interface AgentConfig {
  systemPrompt: string
  maxIterations: number
}

export interface AgentCallbacks {
  onContent?: (text: string) => void
  onToolCall?: (name: string, args: string) => void
  onToolResult?: (name: string, result: string, isError: boolean) => void
  onMaxIterations?: () => void
}

const DEFAULT_CONFIG: AgentConfig = {
  systemPrompt: 'You are a helpful coding assistant.',
  maxIterations: 20,
}

export class Agent {
  private client: DeepSeekClient
  private registry: ToolRegistry
  private config: AgentConfig
  private messages: ChatMessage[] = []

  constructor(
    client: DeepSeekClient,
    registry: ToolRegistry,
    config: Partial<AgentConfig> = {},
  ) {
    this.client = client
    this.registry = registry
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.messages = [systemMessage(this.config.systemPrompt)]
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  async run(input: string, callbacks: AgentCallbacks = {}): Promise<string> {
    this.messages.push(userMessage(input))

    let iterations = 0

    while (iterations < this.config.maxIterations) {
      iterations++

      const response = await this.client.chat(
        this.messages,
        this.registry.toToolDefinitions(),
      )

      const choice = response.choices[0]
      if (!choice) {
        return ''
      }

      const msg = choice.message

      this.messages.push(
        assistantMessage(msg.content, msg.tool_calls),
      )

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        const content = msg.content ?? ''
        if (content) {
          callbacks.onContent?.(content)
        }
        return content
      }

      const toolResults: ChatMessage[] = []

      for (const toolCall of msg.tool_calls) {
        callbacks.onToolCall?.(toolCall.function.name, toolCall.function.arguments)

        const result = await this.registry.execute(
          toolCall.function.name,
          toolCall.function.arguments,
        )

        callbacks.onToolResult?.(
          toolCall.function.name,
          result.content,
          result.isError ?? false,
        )

        toolResults.push(
          toolResultMessage(toolCall.id, result.content),
        )
      }

      this.messages.push(...toolResults)
    }

    callbacks.onMaxIterations?.()
    return `Error: Exceeded maximum iterations (${this.config.maxIterations})`
  }
}
