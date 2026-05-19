import { readdir, stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
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

    let entries: string[]
    try {
      entries = await readdir(dirPath)
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

    entries.sort()

    const lines: string[] = []
    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      try {
        const s = await stat(fullPath)
        lines.push(s.isDirectory() ? `${entry}/` : entry)
      } catch {
        lines.push(entry)
      }
    }

    return { content: `${dirPath}\n${lines.join('\n')}` }
  },
}
