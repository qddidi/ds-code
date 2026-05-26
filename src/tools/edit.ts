import { readFile, writeFile } from 'node:fs/promises'
import type { Tool, ToolResult } from './types.js'
import { assertSafeWritablePathForTool } from './path-safety.js'
import { createUnifiedDiff } from '../utils/unified-diff.js'

export const editTool: Tool = {
  name: 'edit_file',
  description:
    'Perform exact string replacement in a file. ' +
    'Before using this tool, read the file and copy old_string exactly from the current file content. ' +
    'old_string must include the exact indentation, spacing, and line endings, and must be unique unless replace_all=true. ' +
    'Use replace_all=true only when every matching occurrence should be changed.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file' },
      old_string: { type: 'string', description: 'Exact string to find' },
      new_string: { type: 'string', description: 'Replacement string' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default: false)' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  requiresPermission: true,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const safety = assertSafeWritablePathForTool(params.file_path as string)
    if (!safety.ok) {
      return { content: safety.reason ?? `Refusing to edit unsafe path: ${safety.path}`, isError: true }
    }

    const filePath = safety.path
    const oldString = params.old_string as string
    const newString = params.new_string as string
    const replaceAll = (params.replace_all as boolean) || false

    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch {
      return { content: `File not found: ${filePath}`, isError: true }
    }

    if (!content.includes(oldString)) {
      return {
        content:
          `old_string not found in ${filePath}. ` +
          'Read the file again and copy old_string exactly, including indentation, spaces, and line endings.',
        isError: true,
      }
    }

    if (!replaceAll) {
      const firstIndex = content.indexOf(oldString)
      const secondIndex = content.indexOf(oldString, firstIndex + 1)
      if (secondIndex !== -1) {
        return {
          content:
            `Multiple matches found for old_string in ${filePath}. ` +
            'Use replace_all=true to replace all, or provide a more specific old_string.',
          isError: true,
        }
      }
    }

    const updated = replaceAll
      ? content.split(oldString).join(newString)
      : content.replace(oldString, newString)

    await writeFile(filePath, updated, 'utf-8')

    const count = replaceAll
      ? content.split(oldString).length - 1
      : 1

    const diff = createUnifiedDiff(filePath, content, updated)

    return {
      content: `Replaced ${count} occurrence(s) in ${filePath}`,
      displayContent: diff || undefined,
    }
  },
}
