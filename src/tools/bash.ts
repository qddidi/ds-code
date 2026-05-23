import { spawn, execFile } from 'node:child_process'
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

  async execute(params: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
    const command = params.command as string
    const cwd = params.cwd ? resolve(params.cwd as string) : process.cwd()
    const timeoutMs = normalizeTimeout(params.timeout_ms)

    return executeCommand(command, cwd, timeoutMs, signal)
  },
}

function normalizeTimeout(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(1, Math.trunc(value)))
}

function executeCommand(command: string, cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<ToolResult> {
  if (process.platform === 'win32') {
    return executeCommandWithExecFile(command, cwd, timeoutMs, signal)
  }

  return new Promise((resolveResult) => {
    if (signal?.aborted) {
      resolveResult({ content: formatResult('', '', null, false, true), isError: true })
      return
    }

    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
      detached: process.platform !== 'win32',
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    let settled = false

    const finish = (result: ToolResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolveResult(result)
    }

    const stopChild = (): void => {
      if (process.platform !== 'win32' && child.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM')
        } catch {
          child.kill('SIGTERM')
        }
      } else {
        child.kill('SIGTERM')
      }
    }

    const forceStopChild = (): void => {
      if (settled) return
      if (process.platform !== 'win32' && child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          child.kill('SIGKILL')
        }
      } else {
        child.kill('SIGKILL')
      }
    }

    const onAbort = (): void => {
      aborted = true
      stopChild()
      setTimeout(forceStopChild, 100)
    }

    if (signal) {
      signal.addEventListener('abort', onAbort)
    }

    const timer = setTimeout(() => {
      timedOut = true
      stopChild()
      setTimeout(forceStopChild, 100)
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })

    child.on('error', (err) => {
      finish({
        content: formatResult(stdout, stderr || err.message, null, timedOut, aborted),
        isError: true,
      })
    })

    child.on('close', (code) => {
      finish({
        content: formatResult(stdout, stderr, code, timedOut, aborted),
        isError: timedOut || aborted || (typeof code === 'number' && code !== 0) || undefined,
      })
    })
  })
}

function executeCommandWithExecFile(command: string, cwd: string, timeoutMs: number, signal?: AbortSignal): Promise<ToolResult> {
  return new Promise((resolveResult) => {
    if (signal?.aborted) {
      resolveResult({ content: formatResult('', '', null, false, true), isError: true })
      return
    }

    const child = execFile(command, {
      cwd,
      shell: true,
      windowsHide: true,
      timeout: timeoutMs,
      killSignal: 'SIGTERM',
      signal,
    }, (err, stdout, stderr) => {
      const aborted = signal?.aborted ?? false
      const timedOut = isTimeoutError(err)
      const exitCode = err ? getExitCode(err) : 0
      const finish = (): void => {
        resolveResult({
          content: formatResult(String(stdout), String(stderr), exitCode, timedOut, aborted),
          isError: timedOut || aborted || (typeof exitCode === 'number' && exitCode !== 0) || undefined,
        })
      }

      if (timedOut && process.platform === 'win32') {
        setTimeout(finish, 500)
      } else {
        finish()
      }
    })

    child.on('error', (err) => {
      const aborted = signal?.aborted ?? false
      const timedOut = isTimeoutError(err)
      resolveResult({
        content: formatResult('', err.message, getExitCode(err), timedOut, aborted),
        isError: true,
      })
    })
  })
}

function isTimeoutError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'killed' in err && (err as { killed?: boolean }).killed === true
}

function getExitCode(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code?: unknown }).code
    return typeof code === 'number' ? code : null
  }
  return null
}

function formatResult(stdout: string, stderr: string, exitCode: number | null, timedOut: boolean, aborted: boolean): string {
  return [
    `stdout=${JSON.stringify(stdout)}`,
    `stderr=${JSON.stringify(stderr)}`,
    `exitCode=${exitCode === null ? 'null' : exitCode}`,
    `timedOut=${timedOut}`,
    `aborted=${aborted}`,
  ].join('\n')
}
