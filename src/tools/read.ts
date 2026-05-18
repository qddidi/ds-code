import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tool, ToolResult } from './types.js'

const MAX_LINES = 2000

function isBinaryBuffer(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 8192)
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true
  }
  return false
}

function formatWithLineNumbers(lines: string[], startLine: number): string {
  return lines
    .map((line, i) => `${startLine + i}\t${line}`)
    .join('\n')
}

export const readTool: Tool = {
  name: 'read_file',
  description:
    'Read the contents of a file. Returns the file content with line numbers. ' +
    'Use offset and limit to read specific line ranges.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file' },
      offset: { type: 'integer', description: 'Starting line number (1-based, default: 1)' },
      limit: { type: 'integer', description: 'Maximum number of lines to read (default: 2000)' },
    },
    required: ['file_path'],
  },
  requiresPermission: false,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const filePath = resolve(params.file_path as string)
    const offset = Math.max(1, (params.offset as number) || 1)
    const limit = Math.min(MAX_LINES, Math.max(1, (params.limit as number) || MAX_LINES))

    let fileStat
    try {
      fileStat = await stat(filePath)
    } catch {
      return { content: `File not found: ${filePath}`, isError: true }
    }

    if (!fileStat.isFile()) {
      return { content: `Not a file: ${filePath}`, isError: true }
    }

    const buffer = await readFile(filePath)

    if (isBinaryBuffer(buffer)) {
      return { content: `Cannot read binary file: ${filePath}`, isError: true }
    }

    const content = buffer.toString('utf-8')
    const allLines = content.split('\n')
    const totalLines = allLines.length

    const startIndex = offset - 1
    const selectedLines = allLines.slice(startIndex, startIndex + limit)
    const result = formatWithLineNumbers(selectedLines, offset)

    const endLine = Math.min(offset + limit - 1, totalLines)
    const header = `${filePath} (lines ${offset}-${endLine} of ${totalLines})`

    return { content: `${header}\n${result}` }
  },
}
