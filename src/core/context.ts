import type { ChatMessage } from '../api/types.js'
import { estimateMessagesTokens } from '../utils/token-count.js'
import { systemMessage } from './message.js'

export interface ContextManagerOptions {
  maxTokens: number
  compressionThreshold?: number
  preserveRecentMessages?: number
}

export class ContextManager {
  private messages: ChatMessage[] = []
  private maxTokens: number
  private compressionThreshold: number
  private preserveRecentMessages: number

  constructor(options: ContextManagerOptions) {
    this.maxTokens = options.maxTokens
    this.compressionThreshold = options.compressionThreshold ?? 0.8
    this.preserveRecentMessages = options.preserveRecentMessages ?? 4
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message)
  }

  getMessages(): ChatMessage[] {
    return [...this.messages]
  }

  getTotalTokens(): number {
    return estimateMessagesTokens(this.messages)
  }

  shouldCompress(): boolean {
    return this.getTotalTokens() >= this.maxTokens * this.compressionThreshold
  }

  async compress(summarize: (messages: ChatMessage[]) => Promise<string>): Promise<void> {
    const systemMessages = this.messages.filter((message) => message.role === 'system')
    const nonSystemMessages = this.messages.filter((message) => message.role !== 'system')
    const recentMessages = nonSystemMessages.slice(-this.preserveRecentMessages)
    const compressibleMessages = nonSystemMessages.slice(0, Math.max(0, nonSystemMessages.length - this.preserveRecentMessages))

    if (compressibleMessages.length === 0) return

    const summary = await summarize(compressibleMessages)
    this.messages = [
      ...systemMessages,
      systemMessage(`Summary of earlier conversation:\n${summary}`),
      ...recentMessages,
    ]
  }
}
