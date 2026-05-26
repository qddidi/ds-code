import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { writeTool } from '../../src/tools/write.js'

describe('write_file tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-write-'))
    process.env.DS_CODE_WORKSPACE_ROOT = tempDir
  })

  afterEach(async () => {
    delete process.env.DS_CODE_WORKSPACE_ROOT
    await rm(tempDir, { recursive: true })
  })

  it('creates a new file', async () => {
    const filePath = join(tempDir, 'new.txt')
    const result = await writeTool.execute({ file_path: filePath, content: 'hello world' })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('File written')
    expect(result.content).toContain('11 bytes')
    expect(result.content).toContain('diff --git')
    expect(result.content).toContain('--- /dev/null')
    expect(result.content).toContain('+hello world')
    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe('hello world')
  })

  it('creates parent directories automatically', async () => {
    const filePath = join(tempDir, 'a', 'b', 'c', 'deep.txt')
    const result = await writeTool.execute({ file_path: filePath, content: 'deep content' })

    expect(result.isError).toBeUndefined()
    expect(existsSync(filePath)).toBe(true)
    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe('deep content')
  })

  it('overwrites an existing file', async () => {
    const filePath = join(tempDir, 'existing.txt')
    await writeFile(filePath, 'old content', 'utf-8')

    const result = await writeTool.execute({ file_path: filePath, content: 'new content' })
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('diff --git')
    expect(result.content).toContain('-old content')
    expect(result.content).toContain('+new content')

    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe('new content')
  })

  it('omits diff when overwriting with identical content', async () => {
    const filePath = join(tempDir, 'same.txt')
    await writeFile(filePath, 'same content', 'utf-8')

    const result = await writeTool.execute({ file_path: filePath, content: 'same content' })

    expect(result.isError).toBeUndefined()
    expect(result.content).not.toContain('diff --git')
  })

  it('rejects writes outside the current project directory', async () => {
    const filePath = resolve('..', 'outside-ds-code-write-test.txt')
    const result = await writeTool.execute({ file_path: filePath, content: 'nope' })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('outside the current project directory')
  })

  it('requires permission', () => {
    expect(writeTool.requiresPermission).toBe(true)
  })
})
