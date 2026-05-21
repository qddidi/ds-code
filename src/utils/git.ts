import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT_MS = 5000

export interface GitResult {
  ok: boolean
  output: string
  error?: string
}

export interface GitStatusEntry {
  index: string
  workingTree: string
  path: string
}

export async function isGitRepository(cwd = process.cwd()): Promise<boolean> {
  try {
    await access(join(cwd, '.git'))
    return true
  } catch {
    const result = await runGit(['rev-parse', '--is-inside-work-tree'], cwd)
    return result.ok && result.output.trim() === 'true'
  }
}

export async function getCurrentBranch(cwd = process.cwd()): Promise<GitResult> {
  return runGit(['branch', '--show-current'], cwd)
}

export async function getGitStatus(cwd = process.cwd()): Promise<GitResult & { files: GitStatusEntry[] }> {
  const result = await runGit(['status', '--short'], cwd)
  return {
    ...result,
    files: result.ok ? parseStatus(result.output) : [],
  }
}

export async function getGitDiff(cwd = process.cwd()): Promise<GitResult> {
  return runGit(['diff', '--no-color'], cwd)
}

export async function getGitContext(cwd = process.cwd()): Promise<string> {
  const [branch, status, diff] = await Promise.all([
    getCurrentBranch(cwd),
    getGitStatus(cwd),
    getGitDiff(cwd),
  ])

  return [
    `branch: ${branch.ok ? branch.output.trim() : branch.error}`,
    `status:\n${status.ok ? status.output : status.error}`,
    `diff:\n${diff.ok ? diff.output : diff.error}`,
  ].join('\n\n')
}

export async function runGit(args: string[], cwd = process.cwd()): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd, timeout: GIT_TIMEOUT_MS })
    return { ok: true, output: stdout, error: stderr || undefined }
  } catch (err) {
    const error = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
    return {
      ok: false,
      output: error.stdout ?? '',
      error: error.stderr || error.message,
    }
  }
}

function parseStatus(output: string): GitStatusEntry[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => ({
      index: line[0] ?? ' ',
      workingTree: line[1] ?? ' ',
      path: line.slice(3),
    }))
}
