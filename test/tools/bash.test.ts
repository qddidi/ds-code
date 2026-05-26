import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { bashTool } from '../../src/tools/bash.js'

describe('bash tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-bash-'))
  })

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EBUSY') throw err
    }
  })

  it('executes a simple command', async () => {
    const result = await bashTool.execute({ command: "node -e 'process.stdout.write(\"hello\")'", cwd: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('exitCode=0')
  })

  it('captures stderr', async () => {
    const result = await bashTool.execute({ command: 'node -e "console.error(\'oops\')"', cwd: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('stderr="oops\\n"')
    expect(result.content).toContain('exitCode=0')
  })

  it('returns non-zero exit codes as errors', async () => {
    const result = await bashTool.execute({ command: 'node -e "process.exit(7)"', cwd: tempDir })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('exitCode=7')
  })

  it('terminates commands that exceed timeout', async () => {
    const result = await bashTool.execute({ command: 'node -e "setTimeout(() => {}, 10000)"', cwd: tempDir, timeout_ms: 50 })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('timedOut=true')
  }, 10000)

  it('closes stdin so commands waiting for input do not hang', async () => {
    const script = `process.stdin.resume(); process.stdin.on('end', () => { process.stdout.write('eof') })`
    const result = await bashTool.execute({ command: `node -e "${script}"`, cwd: tempDir, timeout_ms: 1000 })

    expect(result.content).toContain('stdout="eof"')
    expect(result.content).toContain('exitCode=0')
    expect(result.content).toContain('timedOut=false')
  })

  it('runs commands in the requested working directory', async () => {
    const nestedDir = join(tempDir, 'nested')
    await mkdir(nestedDir)

    const result = await bashTool.execute({ command: 'node -e "console.log(process.cwd())"', cwd: nestedDir })

    expect(result.content).toContain(nestedDir.replace(/\\/g, '\\\\'))
    expect(result.content).toContain('exitCode=0')
  })

  it('marks bash as requiring permission', () => {
    expect(bashTool.requiresPermission).toBe(true)
  })

  it('passes arguments through without constructing commands from separate params', async () => {
    const result = await bashTool.execute({ command: 'node -e "console.log(process.argv[1])" "hello; exit 9"', cwd: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('hello; exit 9')
    expect(result.content).toContain('exitCode=0')
  })

  it('does not re-execute shell warning lines from generated scripts', async () => {
    const scriptPath = join(tempDir, 'loop.js')
    await writeFile(scriptPath, "console.log('Unknown command: \"warn\"')", 'utf-8')

    const result = await bashTool.execute({ command: `node ${JSON.stringify(scriptPath)}`, cwd: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('Unknown command: \\\"warn\\\"')
    expect(result.content).toContain('exitCode=0')
  })
})
