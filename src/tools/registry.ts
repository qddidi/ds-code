import type { ToolDefinition } from '../api/types.js'
import type { Tool, ToolResult } from './types.js'

export class ToolRegistry {
  private tools = new Map<string, Tool>()

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`)
    }
    this.tools.set(tool.name, tool)
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  list(): Tool[] {
    return [...this.tools.values()]
  }

  toToolDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }))
  }

  async execute(name: string, argsJson: string): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: `Unknown tool: ${name}`, isError: true }
    }

    let params: Record<string, unknown>
    try {
      params = JSON.parse(argsJson) as Record<string, unknown>
    } catch {
      return { content: `Invalid JSON arguments: ${argsJson}`, isError: true }
    }

    const validationError = this.validate(tool, params)
    if (validationError) {
      return { content: validationError, isError: true }
    }

    try {
      return await tool.execute(params)
    } catch (err) {
      return {
        content: err instanceof Error ? err.message : String(err),
        isError: true,
      }
    }
  }

  private validate(tool: Tool, params: Record<string, unknown>): string | null {
    const { properties, required } = tool.parameters

    if (required) {
      for (const field of required) {
        if (!(field in params) || params[field] === undefined || params[field] === null) {
          return `Missing required parameter: ${field}`
        }
      }
    }

    for (const [key, value] of Object.entries(params)) {
      const schema = properties[key] as { type?: string } | undefined
      if (!schema) continue

      if (schema.type && !matchesType(value, schema.type)) {
        return `Parameter "${key}" expected type "${schema.type}", got "${typeof value}"`
      }
    }

    return null
  }
}

function matchesType(value: unknown, expectedType: string): boolean {
  switch (expectedType) {
    case 'string':
      return typeof value === 'string'
    case 'number':
    case 'integer':
      return typeof value === 'number'
    case 'boolean':
      return typeof value === 'boolean'
    case 'array':
      return Array.isArray(value)
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value)
    default:
      return true
  }
}
