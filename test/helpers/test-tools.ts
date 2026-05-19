import type { Tool, ToolResult } from '../../src/tools/types.js'

export async function executeTool(tool: Tool, params: Record<string, unknown>): Promise<ToolResult> {
  return tool.execute(params)
}

export function expectToolSuccess(result: ToolResult): string {
  if (result.isError) {
    throw new Error(`Expected tool success, got error: ${result.content}`)
  }
  return result.content
}

export function expectToolError(result: ToolResult): string {
  if (!result.isError) {
    throw new Error(`Expected tool error, got success: ${result.content}`)
  }
  return result.content
}
