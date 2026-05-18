export interface ToolResult {
  content: string
  isError?: boolean
}

export interface ToolParameters {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

export interface Tool {
  name: string
  description: string
  parameters: ToolParameters
  requiresPermission: boolean
  execute(params: Record<string, unknown>): Promise<ToolResult>
}
