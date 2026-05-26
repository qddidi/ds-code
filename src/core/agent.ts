import type { ChatMessage, ToolDefinition } from '../api/types.js'
import type { ToolRegistry, ExecutedToolResult } from '../tools/registry.js'
import { ContextManager } from './context.js'
import { systemMessage, userMessage, assistantMessage, toolResultMessage } from './message.js'

export interface AgentConfig {
  systemPrompt: string
  maxIterations: number | null
  maxContextTokens: number
  maxRepeatedToolErrors: number
}

export interface AgentCallbacks {
  onContent?: (text: string) => void
  onThinking?: (text: string) => void
  onToolCallStart?: () => void
  onToolCall?: (name: string, args: string) => void
  onToolResult?: (name: string, result: string, isError: boolean, displayContent?: string) => void
  onModelError?: (error: Error, attempt: number) => void
  onMaxIterations?: () => void
  onCompressing?: () => void
}

const DEFAULT_CONFIG: AgentConfig = {
  systemPrompt: 'You are a helpful coding assistant.',
  maxIterations: null,
  maxContextTokens: 64000,
  maxRepeatedToolErrors: 3,
}

export interface ChatClient {
  chatStream(messages: ChatMessage[], callbacks: {
    onContent?: (text: string) => void
    onThinking?: (text: string) => void
    onToolCallStart?: () => void
  }, tools?: ToolDefinition[], signal?: AbortSignal): Promise<ChatMessage>
}

export class Agent {
  private client: ChatClient
  private registry: ToolRegistry
  private config: AgentConfig
  private messages: ChatMessage[] = []
  private contextManager: ContextManager
  private toolDefinitions: ToolDefinition[]

  constructor(
    client: ChatClient,
    registry: ToolRegistry,
    config: Partial<AgentConfig> = {},
  ) {
    this.client = client
    this.registry = registry
    this.toolDefinitions = registry.toToolDefinitions()
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
          userMessage(formatMessagesForSummary(msgs)),
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
    const repeatedToolErrors = new Map<string, number>()

    while (this.config.maxIterations === null || iterations < this.config.maxIterations) {
      if (signal?.aborted) {
        return ''
      }

      iterations++

      let message: ChatMessage
      try {
        message = await this.client.chatStream(
          this.messages,
          {
            onContent: (chunk) => { callbacks.onContent?.(chunk) },
            onThinking: (chunk) => { callbacks.onThinking?.(chunk) },
            onToolCallStart: () => { callbacks.onToolCallStart?.() },
          },
          this.toolDefinitions,
          signal,
        )
      } catch (err) {
        if (signal?.aborted) return ''
        const error = err instanceof Error ? err : new Error(String(err))
        callbacks.onModelError?.(error, iterations)
        const retryMsg = userMessage(`[System: The previous model API call failed: ${error.message}. Continue from the last successful state and try again.]`)
        this.messages.push(retryMsg)
        this.contextManager.addMessage(retryMsg)
        continue
      }

      const assistantMsg = assistantMessage(message.content, message.tool_calls, message.reasoning_content)
      this.messages.push(assistantMsg)
      this.contextManager.addMessage(assistantMsg)

      if (!message.tool_calls || message.tool_calls.length === 0) {
        if (message.finish_reason === 'length') {
          const continueMsg = userMessage('[System: Your response was truncated due to length. Continue from where you left off.]')
          this.messages.push(continueMsg)
          this.contextManager.addMessage(continueMsg)
          continue
        }
        return message.content ?? ''
      }

      const toolResults = await this.executeToolCalls(message.tool_calls, callbacks, signal)
      if (signal?.aborted) {
        return ''
      }

      if (this.shouldStopRepeatedToolErrors(toolResults, repeatedToolErrors)) {
        return toolResults.at(-1)?.content ?? 'Error: Repeated tool failures.'
      }

      for (const toolMsg of toolResults) {
        this.contextManager.addMessage(toolMsg)
      }
      this.messages.push(...toolResults)
    }

    callbacks.onMaxIterations?.()
    return `Error: Exceeded maximum iterations (${this.config.maxIterations})`
  }

  private async executeToolCalls(
    toolCalls: NonNullable<ChatMessage['tool_calls']>,
    callbacks: AgentCallbacks,
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    if (toolCalls.every((toolCall) => this.registry.isReadOnly(toolCall.function.name))) {
      return Promise.all(toolCalls.map(async (toolCall) => {
        callbacks.onToolCall?.(toolCall.function.name, toolCall.function.arguments)
        const result = await this.registry.execute(toolCall.function.name, toolCall.function.arguments, signal)
        callbacks.onToolResult?.(toolCall.function.name, result.content, result.isError ?? false, getDisplayContent(result))
        return toolResultMessage(toolCall.id, formatToolResultContent(result.content, result.isError ?? false))
      }))
    }

    const results: ChatMessage[] = []
    for (const toolCall of toolCalls) {
      if (signal?.aborted) return results
      callbacks.onToolCall?.(toolCall.function.name, toolCall.function.arguments)
      const result = await this.registry.execute(toolCall.function.name, toolCall.function.arguments, signal)
      callbacks.onToolResult?.(toolCall.function.name, result.content, result.isError ?? false, getDisplayContent(result))
      results.push(toolResultMessage(toolCall.id, formatToolResultContent(result.content, result.isError ?? false)))
    }
    return results
  }

  private shouldStopRepeatedToolErrors(toolResults: ChatMessage[], repeatedToolErrors: Map<string, number>): boolean {
    let shouldStop = false
    for (const toolMsg of toolResults) {
      const content = toolMsg.content ?? ''
      if (!content.startsWith('Tool error:')) continue
      const key = content
      const count = (repeatedToolErrors.get(key) ?? 0) + 1
      repeatedToolErrors.set(key, count)
      if (count >= this.config.maxRepeatedToolErrors) {
        toolMsg.content = `${content}\nStopped after ${count} repeated identical tool errors.`
        shouldStop = true
      }
    }
    return shouldStop
  }
}

function getDisplayContent(result: ExecutedToolResult): string | undefined {
  return result.displayContent
}

function formatToolResultContent(content: string, isError: boolean): string {
  if (!isError) return content
  return `Tool error: ${content}`
}

function formatMessagesForSummary(messages: ChatMessage[]): string {
  return messages.map(formatMessageForSummary).join('\n')
}

function formatMessageForSummary(message: ChatMessage): string {
  const parts = [`[${message.role}]`]
  if (message.content) parts.push(message.content)
  if (message.reasoning_content) parts.push(`reasoning_content=${message.reasoning_content}`)
  if (message.tool_calls) {
    parts.push(`tool_calls=${JSON.stringify(message.tool_calls)}`)
  }
  if (message.tool_call_id) parts.push(`tool_call_id=${message.tool_call_id}`)
  return parts.join(' ')
}
