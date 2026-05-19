import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { globTool } from '../../src/tools/glob.js'

async function makeProject(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'ds-glob-'))
  await mkdir(join(tempDir, 'src', 'nested'), { recursive: true })
  await mkdir(join(tempDir, 'node_modules', 'pkg'), { recursive: true })
  await writeFile(join(tempDir, 'src', 'index.ts'), 'export const value = 1\n')
  await writeFile(join(tempDir, 'src', 'nested', 'util.ts'), 'export const util = 1\n')
  await writeFile(join(tempDir, 'src', 'readme.md'), '# readme\n')
  await writeFile(join(tempDir, 'node_modules', 'pkg', 'ignored.ts'), 'export const ignored = 1\n')
  return tempDir
}

describe('glob tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await makeProject()
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('matches files recursively', async () => {
    const result = await globTool.execute({ pattern: '**/*.ts', path: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('src/index.ts')
    expect(result.content).toContain('src/nested/util.ts')
  })

  it('returns an empty result without error when nothing matches', async () => {
    const result = await globTool.execute({ pattern: '**/*.tsx', path: tempDir })

    expect(result.isError).toBeUndefined()
    expect(result.content).toBe('No files matched the pattern.')
  })

  it('ignores node_modules by default', async () => {
    const result = await globTool.execute({ pattern: '**/*.ts', path: tempDir })

    expect(result.content).not.toContain('node_modules')
  })
})
