import fg from 'fast-glob'
import { resolve } from 'node:path'
import type { Tool, ToolResult } from './types.js'

const DEFAULT_IGNORE = ['**/node_modules/**', '**/.git/**']

export const globTool: Tool = {
  name: 'glob',
  description:
    'Find files matching a glob pattern. Returns a list of matching file paths. ' +
    'Supports patterns like "**/*.ts", "src/**/*.{js,ts}", etc.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern to match files' },
      path: { type: 'string', description: 'Base directory to search in (default: cwd)' },
    },
    required: ['pattern'],
  },
  requiresPermission: false,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const pattern = params.pattern as string
    const basePath = params.path ? resolve(params.path as string) : process.cwd()

    let files: string[]
    try {
      files = await fg(pattern, {
        cwd: basePath,
        ignore: DEFAULT_IGNORE,
        dot: false,
        absolute: true,
        onlyFiles: true,
      })
    } catch (err) {
      return {
        content: err instanceof Error ? err.message : String(err),
        isError: true,
      }
    }

    files.sort()

    if (files.length === 0) {
      return { content: 'No files matched the pattern.' }
    }

    const header = `Found ${files.length} file(s):`
    return { content: `${header}\n${files.join('\n')}` }
  },
}
