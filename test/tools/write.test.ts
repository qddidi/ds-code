import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { writeTool } from '../../src/tools/write.js'

describe('write_file tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-write-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('creates a new file', async () => {
    const filePath = join(tempDir, 'new.txt')
    const result = await writeTool.execute({ file_path: filePath, content: 'hello world' })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('File written')
    expect(result.content).toContain('11 bytes')
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

    const written = await readFile(filePath, 'utf-8')
    expect(written).toBe('new content')
  })

  it('requires permission', () => {
    expect(writeTool.requiresPermission).toBe(true)
  })
})
