import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Tool, ToolResult } from './types.js'

export const editTool: Tool = {
  name: 'edit_file',
  description:
    'Perform exact string replacement in a file. ' +
    'Finds old_string and replaces it with new_string. ' +
    'Use replace_all=true to replace all occurrences.',
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
    const filePath = resolve(params.file_path as string)
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
      return { content: `old_string not found in ${filePath}`, isError: true }
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

    return { content: `Replaced ${count} occurrence(s) in ${filePath}` }
  },
}
