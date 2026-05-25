import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { Tool, ToolResult } from './types.js'

export const writeTool: Tool = {
  name: 'write_file',
  description:
    'Create or overwrite a file with the given content. ' +
    'Parent directories are created automatically if they do not exist.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['file_path', 'content'],
  },
  requiresPermission: true,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(params.file_path as string)
    const content = params.content as string

    const dir = dirname(filePath)
    await mkdir(dir, { recursive: true })
    await writeFile(filePath, content, 'utf-8')

    const bytes = Buffer.byteLength(content, 'utf-8')
    return { content: `File written: ${filePath} (${bytes} bytes)` }
  },
}
