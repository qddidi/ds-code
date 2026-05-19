import type { ChatMessage, ToolCall } from '../api/types.js'

export type { ChatMessage, ToolCall }

export function systemMessage(content: string): ChatMessage {
  return { role: 'system', content }
}

export function userMessage(content: string): ChatMessage {
  return { role: 'user', content }
}

export function assistantMessage(
  content: string | null,
  toolCalls?: ToolCall[],
  reasoningContent?: string | null,
): ChatMessage {
  const msg: ChatMessage = { role: 'assistant', content }
  if (reasoningContent !== undefined) {
    msg.reasoning_content = reasoningContent
  }
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
    if (msg.reasoning_content !== undefined) {
      serialized.reasoning_content = msg.reasoning_content
    }
    if (msg.tool_calls) {
      serialized.tool_calls = msg.tool_calls
    }
    if (msg.tool_call_id) {
      serialized.tool_call_id = msg.tool_call_id
    }
    return serialized
  })
}
