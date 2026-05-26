import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Tool, ToolResult } from './types.js'
import { assertSafeWritablePathForTool } from './path-safety.js'
import { createNewFileDiff, createUnifiedDiff } from '../utils/unified-diff.js'

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
    const safety = assertSafeWritablePathForTool(params.file_path as string)
    if (!safety.ok) {
      return { content: safety.reason ?? `Refusing to write unsafe path: ${safety.path}`, isError: true }
    }

    const filePath = safety.path
    const content = params.content as string

    const dir = dirname(filePath)
    const existingContent = await readExistingFile(filePath)
    await mkdir(dir, { recursive: true })
    await writeFile(filePath, content, 'utf-8')

    const bytes = Buffer.byteLength(content, 'utf-8')
    const diff = existingContent === undefined
      ? createNewFileDiff(filePath, content)
      : createUnifiedDiff(filePath, existingContent, content)
    const diffSuffix = diff.length > 0 ? `\n\n${diff}` : ''
    return { content: `File written: ${filePath} (${bytes} bytes)${diffSuffix}` }
  },
}

async function readExistingFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch (error: unknown) {
    if (isFileNotFoundError(error)) return undefined
    throw error
  }
}

function isFileNotFoundError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
