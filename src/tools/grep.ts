import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import { resolve } from 'node:path'
import { isBinaryBuffer } from '../utils/binary.js'
import { DEFAULT_IGNORE } from './default-ignore.js'
import type { Tool, ToolResult } from './types.js'

const MAX_RESULTS = 100

interface MatchResult {
  file: string
  line: number
  content: string
  context?: string[]
}

export const grepTool: Tool = {
  name: 'grep',
  description:
    'Search file contents using a regex pattern. Returns matching lines with file paths and line numbers.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'Directory to search in (default: cwd)' },
      glob: { type: 'string', description: 'File glob filter (e.g. "*.ts")' },
      ignore_case: { type: 'boolean', description: 'Case-insensitive search (default: false)' },
      context_lines: { type: 'integer', description: 'Number of context lines before and after match (default: 0)' },
    },
    required: ['pattern'],
  },
  requiresPermission: false,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const patternStr = params.pattern as string
    const basePath = params.path ? resolve(params.path as string) : process.cwd()
    const globPattern = (params.glob as string) || '**/*'
    const ignoreCase = (params.ignore_case as boolean) || false
    const contextLines = Math.max(0, Math.min(5, (params.context_lines as number) || 0))

    let regex: RegExp
    try {
      regex = new RegExp(patternStr, ignoreCase ? 'i' : '')
    } catch {
      return { content: `Invalid regex pattern: ${patternStr}`, isError: true }
    }

    let files: string[]
    try {
      files = await fg(globPattern, {
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

    const matches: MatchResult[] = []
    let truncated = false

    for (const file of files) {
      if (matches.length >= MAX_RESULTS) {
        truncated = true
        break
      }

      let content: string
      try {
        const buffer = await readFile(file)
        if (isBinaryBuffer(buffer)) continue
        content = buffer.toString('utf-8')
      } catch {
        continue
      }

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line === undefined || !regex.test(line)) continue

        const match: MatchResult = {
          file,
          line: i + 1,
          content: line,
        }

        if (contextLines > 0) {
          const start = Math.max(0, i - contextLines)
          const end = Math.min(lines.length - 1, i + contextLines)
          const ctx: string[] = []
          for (let j = start; j <= end; j++) {
            const contextLine = lines[j]
            if (contextLine === undefined) continue
            const prefix = j === i ? '>' : ' '
            ctx.push(`${prefix} ${j + 1}\t${contextLine}`)
          }
          match.context = ctx
        }

        matches.push(match)
        if (matches.length >= MAX_RESULTS) {
          truncated = true
          break
        }
      }
    }

    if (matches.length === 0) {
      return { content: 'No matches found.' }
    }

    const output = formatMatches(matches, contextLines > 0)
    const header = truncated
      ? `Found ${matches.length}+ matches (truncated at ${MAX_RESULTS}):`
      : `Found ${matches.length} match(es):`

    return { content: `${header}\n\n${output}` }
  },
}

function formatMatches(matches: MatchResult[], hasContext: boolean): string {
  if (hasContext) {
    return matches
      .map((m) => `${m.file}:\n${m.context!.join('\n')}`)
      .join('\n\n')
  }

  return matches
    .map((m) => `${m.file}:${m.line}\t${m.content}`)
    .join('\n')
}
