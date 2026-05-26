import type { ToolDefinition } from '../api/types.js'
import type { Tool, ToolResult } from './types.js'
import type { PermissionManager } from '../permissions/manager.js'

export interface ExecutedToolResult extends ToolResult {
  displayContent?: string
}

export class ToolRegistry {
  private tools = new Map<string, Tool>()
  private permissionManager: PermissionManager | null = null

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

  isReadOnly(name: string): boolean {
    return this.tools.get(name)?.requiresPermission === false
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

  setPermissionManager(manager: PermissionManager): void {
    this.permissionManager = manager
  }

  async execute(name: string, argsJson: string, signal?: AbortSignal): Promise<ExecutedToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      return { content: `Unknown tool: ${name}`, isError: true }
    }

    if (signal?.aborted) {
      return { content: 'Aborted', isError: true }
    }

    let params: Record<string, unknown>
    try {
      params = JSON.parse(argsJson) as Record<string, unknown>
    } catch {
      return { content: `Invalid JSON arguments: ${argsJson}`, isError: true }
    }

    if (this.permissionManager && tool.requiresPermission) {
      const permResult = await this.permissionManager.check(tool, params)
      if (permResult.decision === 'deny') {
        return { content: `Permission denied: ${permResult.reason}`, isError: true }
      }
      if (permResult.decision === 'confirm') {
        return {
          content: `Permission requires confirmation but no confirm callback is set: ${permResult.reason}`,
          isError: true,
        }
      }
    }

    const validationError = this.validate(tool, params)
    if (validationError) {
      return { content: validationError, isError: true }
    }

    try {
      return await tool.execute(params, signal)
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
