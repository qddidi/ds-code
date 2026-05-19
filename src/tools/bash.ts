import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import type { Tool, ToolResult } from './types.js'

const DEFAULT_TIMEOUT_MS = 120_000
const MAX_TIMEOUT_MS = 600_000

export const bashTool: Tool = {
  name: 'bash',
  description:
    'Execute a shell command in the current project directory. Returns stdout, stderr, and exit code.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (default: current process cwd)' },
      timeout_ms: { type: 'integer', description: 'Timeout in milliseconds (default: 120000, max: 600000)' },
    },
    required: ['command'],
  },
  requiresPermission: true,

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const command = params.command as string
    const cwd = params.cwd ? resolve(params.cwd as string) : process.cwd()
    const timeoutMs = normalizeTimeout(params.timeout_ms)

    return executeCommand(command, cwd, timeoutMs)
  },
}

function normalizeTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(1, Math.trunc(value)))
}

function executeCommand(command: string, cwd: string, timeoutMs: number): Promise<ToolResult> {
  return new Promise((resolveResult) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const finish = (result: ToolResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolveResult(result)
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL')
      }, 100)
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })

    child.on('error', (err) => {
      finish({
        content: formatResult(stdout, stderr || err.message, null, timedOut),
        isError: true,
      })
    })

    child.on('close', (code) => {
      finish({
        content: formatResult(stdout, stderr, code, timedOut),
        isError: timedOut || undefined,
      })
    })
  })
}

function formatResult(stdout: string, stderr: string, exitCode: number | null, timedOut: boolean): string {
  return [
    `stdout=${JSON.stringify(stdout)}`,
    `stderr=${JSON.stringify(stderr)}`,
    `exitCode=${exitCode === null ? 'null' : exitCode}`,
    `timedOut=${timedOut}`,
  ].join('\n')
}
