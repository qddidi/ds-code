import { describe, it, expect } from 'vitest'
import { PermissionManager } from '../../src/permissions/manager.js'
import { ToolRegistry } from '../../src/tools/registry.js'
import type { Tool } from '../../src/tools/types.js'

function createMockTool(name = 'test_tool', overrides: Partial<Tool> = {}): Tool {
  return {
    name,
    description: 'A test tool',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        count: { type: 'number', description: 'Count' },
      },
      required: ['path'],
    },
    requiresPermission: false,
    execute: async (params) => ({ content: `executed with ${JSON.stringify(params)}` }),
    ...overrides,
  }
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const registry = new ToolRegistry()
    const tool = createMockTool()
    registry.register(tool)

    expect(registry.get('test_tool')).toBe(tool)
    expect(registry.has('test_tool')).toBe(true)
  })

  it('throws on duplicate registration', () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool())

    expect(() => registry.register(createMockTool())).toThrow(
      'Tool "test_tool" is already registered',
    )
  })

  it('returns undefined for unknown tool', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('reports read-only tools from requiresPermission metadata', () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool('readish', { requiresPermission: false }))
    registry.register(createMockTool('writeish', { requiresPermission: true }))

    expect(registry.isReadOnly('readish')).toBe(true)
    expect(registry.isReadOnly('writeish')).toBe(false)
    expect(registry.isReadOnly('missing')).toBe(false)
  })

  it('exports OpenAI-compatible tool definitions', () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool('read_file'))

    const defs = registry.toToolDefinitions()
    expect(defs).toHaveLength(1)
    expect(defs[0]).toEqual({
      type: 'function',
      function: {
        name: 'read_file',
        description: 'A test tool',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
            count: { type: 'number', description: 'Count' },
          },
          required: ['path'],
        },
      },
    })
  })

  it('validates missing required parameter', async () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool())

    const result = await registry.execute('test_tool', '{}')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Missing required parameter: path')
  })

  it('validates type mismatch', async () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool())

    const result = await registry.execute('test_tool', '{"path": 123}')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('expected type "string"')
  })

  it('executes tool successfully', async () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool())

    const result = await registry.execute('test_tool', '{"path": "/tmp/a.ts"}')
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('/tmp/a.ts')
  })

  it('returns error for unknown tool execution', async () => {
    const registry = new ToolRegistry()
    const result = await registry.execute('nope', '{}')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Unknown tool: nope')
  })

  it('returns error for invalid JSON arguments', async () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool())

    const result = await registry.execute('test_tool', 'not json')
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Invalid JSON')
  })

  it('catches tool execution errors', async () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool('failing', {
      execute: async () => { throw new Error('disk full') },
    }))

    const result = await registry.execute('failing', '{"path": "x"}')
    expect(result.isError).toBe(true)
    expect(result.content).toBe('disk full')
  })

  it('returns clear error when confirmation is required without a callback', async () => {
    const registry = new ToolRegistry()
    registry.register(createMockTool('write_file', { requiresPermission: true }))
    registry.setPermissionManager(new PermissionManager())

    const result = await registry.execute('write_file', '{"path":"x"}')

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Permission requires confirmation but no confirm callback is set')
  })
})
