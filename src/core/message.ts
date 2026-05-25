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

export interface DefaultSystemPromptOptions {
  cwd: string
  agentInstructions?: string
}

export function defaultSystemPrompt(options: DefaultSystemPromptOptions): string {
  const projectInstructions = options.agentInstructions
    ? `Project instructions from AGENTS.md:\n${options.agentInstructions}\n\n`
    : ''

  return `You are ds-code, an AI coding assistant running in the user's terminal.

Working directory: ${options.cwd}

${projectInstructions}You have tools to read, write, edit, list, search files, and execute shell commands. Use tools only when the user asks about code, files, or the project. For general conversation, respond directly without using tools.

When editing an existing file, prefer edit over shell commands. Before calling edit, read the file and copy old_string exactly from the current file content, including indentation, spaces, and line endings. Make old_string unique unless every match should be replaced with replace_all=true.

IMPORTANT: When working on a task, complete it fully before responding. Do not stop in the middle to give progress updates. Keep using tools until the task is done, then provide a final summary.

Temporary scripts or scratch files created for task execution must be placed under ${options.cwd}/.ds-code/scripts/ instead of the workspace root. Before writing or running non-Node scripts, first check that the required runtime exists on the user's machine with the bash tool.`
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
