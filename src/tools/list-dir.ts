import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tool, ToolResult } from './types.js'

export const listDirTool: Tool = {
  name: 'list_dir',
  description:
    'List the contents of a directory. Returns file and subdirectory names with type indicators.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute path to the directory' },
    },
    required: ['path'],
  },
  requiresPermission: false,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const dirPath = resolve(params.path as string)

    let entries: Awaited<ReturnType<typeof readdir>>
    try {
      entries = await readdir(dirPath, { withFileTypes: true })
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        return { content: `Directory not found: ${dirPath}`, isError: true }
      }
      if (code === 'ENOTDIR') {
        return { content: `Not a directory: ${dirPath}`, isError: true }
      }
      return {
        content: err instanceof Error ? err.message : String(err),
        isError: true,
      }
    }

    if (entries.length === 0) {
      return { content: `${dirPath} (empty directory)` }
    }

    const lines = entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => entry.isDirectory() ? `${entry.name}/` : entry.name)

    return { content: `${dirPath}\n${lines.join('\n')}` }
  },
}
