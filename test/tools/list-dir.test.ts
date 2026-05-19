import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listDirTool } from '../../src/tools/list-dir.js'

describe('list_dir tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-list-dir-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('lists files and directories', async () => {
    await mkdir(join(tempDir, 'src'))
    await writeFile(join(tempDir, 'package.json'), '{}\n')

    const result = await listDirTool.execute({ path: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('package.json')
    expect(result.content).toContain('src/')
  })

  it('returns an empty directory message', async () => {
    const result = await listDirTool.execute({ path: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('(empty directory)')
  })

  it('returns an error for missing directories', async () => {
    const result = await listDirTool.execute({ path: join(tempDir, 'missing') })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Directory not found')
  })

  it('returns an error for files', async () => {
    const filePath = join(tempDir, 'file.txt')
    await writeFile(filePath, 'hello\n')

    const result = await listDirTool.execute({ path: filePath })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Not a directory')
  })
})
