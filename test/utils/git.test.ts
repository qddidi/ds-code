import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getCurrentBranch, getGitDiff, getGitStatus, isGitRepository, runGit } from '../../src/utils/git.js'

const execFileAsync = promisify(execFile)

describe('git utils', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-git-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  async function initRepo(): Promise<void> {
    await execFileAsync('git', ['init'], { cwd: tempDir })
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: tempDir })
    await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: tempDir })
    await writeFile(join(tempDir, 'file.txt'), 'hello\n')
    await execFileAsync('git', ['add', 'file.txt'], { cwd: tempDir })
    await execFileAsync('git', ['commit', '-m', 'initial'], { cwd: tempDir })
  }

  it('detects a git repository', async () => {
    await initRepo()

    await expect(isGitRepository(tempDir)).resolves.toBe(true)
  })

  it('returns false outside a git repository', async () => {
    await expect(isGitRepository(tempDir)).resolves.toBe(false)
  })

  it('gets the current branch name', async () => {
    await initRepo()

    const result = await getCurrentBranch(tempDir)

    expect(result.ok).toBe(true)
    expect(result.output.trim()).toMatch(/^(main|master)$/)
  })

  it('gets changed file status entries', async () => {
    await initRepo()
    await writeFile(join(tempDir, 'file.txt'), 'changed\n')

    const result = await getGitStatus(tempDir)

    expect(result.ok).toBe(true)
    expect(result.files).toEqual([{ index: ' ', workingTree: 'M', path: 'file.txt' }])
  })

  it('gets unified diff output', async () => {
    await initRepo()
    await writeFile(join(tempDir, 'file.txt'), 'changed\n')

    const result = await getGitDiff(tempDir)

    expect(result.ok).toBe(true)
    expect(result.output).toContain('diff --git')
    expect(result.output).toContain('-hello')
    expect(result.output).toContain('+changed')
  })

  it('gracefully reports git command failures', async () => {
    const result = await runGit(['definitely-not-a-git-subcommand'], tempDir)

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })
})
