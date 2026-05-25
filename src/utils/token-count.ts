import type { ChatMessage } from '../api/types.js'

const CONSERVATIVE_TOKEN_MARGIN = 1.2

export function estimateTokens(text: string): number {
  let count = 0
  let i = 0

  while (i < text.length) {
    const code = text.charCodeAt(i)

    if (code >= 0x4e00 && code <= 0x9fff) {
      // CJK characters: ~1.5 tokens per character
      count += 1.5
      i++
    } else if (code <= 0x7f) {
      // ASCII: count word boundaries
      let wordLen = 0
      while (i < text.length && text.charCodeAt(i) > 0x20 && text.charCodeAt(i) <= 0x7f) {
        wordLen++
        i++
      }
      if (wordLen > 0) {
        // ~4 chars per token for English
        count += Math.max(1, wordLen / 4)
      } else {
        // whitespace/control
        count += 0.25
        i++
      }
    } else {
      // other unicode: ~1.5 tokens per character
      count += 1.5
      i++
    }
  }

  return Math.ceil(count * CONSERVATIVE_TOKEN_MARGIN)
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  let total = 0
  for (const msg of messages) {
    // per-message overhead (~4 tokens for role + formatting)
    total += 4
    if (msg.content) {
      total += estimateTokens(msg.content)
    }
    if (msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        total += estimateTokens(tc.function.name)
        total += estimateTokens(tc.function.arguments)
        total += 3 // overhead for tool call structure
      }
    }
    if (msg.tool_call_id) {
      total += 1
    }
  }
  // conversation overhead, including conservative margin for fixed structural tokens
  total += 3
  return Math.ceil(total * CONSERVATIVE_TOKEN_MARGIN)
}
