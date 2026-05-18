import type { ChatMessage, ToolCall } from '../api/types.js'

export type { ChatMessage, ToolCall }

export function systemMessage(content: string): ChatMessage {
  return { role: 'system', content }
}

export function userMessage(content: string): ChatMessage {
  return { role: 'user', content }
}

export function assistantMessage(content: string | null, toolCalls?: ToolCall[]): ChatMessage {
  const msg: ChatMessage = { role: 'assistant', content }
  if (toolCalls && toolCalls.length > 0) {
    msg.tool_calls = toolCalls
  }
  return msg
}

export function toolResultMessage(toolCallId: string, content: string): ChatMessage {
  return { role: 'tool', content, tool_call_id: toolCallId }
}

export function serializeMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    const serialized: ChatMessage = { role: msg.role, content: msg.content }
    if (msg.tool_calls) {
      serialized.tool_calls = msg.tool_calls
    }
    if (msg.tool_call_id) {
      serialized.tool_call_id = msg.tool_call_id
    }
    return serialized
  })
}
