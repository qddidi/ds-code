import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { grepTool } from '../../src/tools/grep.js'

describe('grep tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-grep-'))
    await mkdir(join(tempDir, 'src'), { recursive: true })
    await writeFile(join(tempDir, 'src', 'main.ts'), [
      'const first = 1',
      'function runTask() {',
      '  return "TODO: finish"',
      '}',
      'const done = true',
    ].join('\n'))
    await writeFile(join(tempDir, 'src', 'other.ts'), 'const note = "todo lower"\n')
    await writeFile(join(tempDir, 'src', 'binary.bin'), Buffer.from([0x41, 0x00, 0x42]))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('finds matching lines with file and line number', async () => {
    const result = await grepTool.execute({ pattern: 'TODO', path: tempDir, glob: '**/*.ts' })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('src/main.ts')
    expect(result.content).toContain('3\t  return "TODO: finish"')
  })

  it('supports regex patterns', async () => {
    const result = await grepTool.execute({ pattern: 'function\\s+\\w+', path: tempDir, glob: '**/*.ts' })

    expect(result.content).toContain('function runTask()')
  })

  it('supports case-insensitive search', async () => {
    const result = await grepTool.execute({ pattern: 'TODO', path: tempDir, glob: '**/*.ts', ignore_case: true })

    expect(result.content).toContain('TODO: finish')
    expect(result.content).toContain('todo lower')
  })

  it('returns context lines around matches', async () => {
    const result = await grepTool.execute({ pattern: 'TODO', path: tempDir, glob: '**/*.ts', context_lines: 1 })

    expect(result.content).toContain(' 2\tfunction runTask() {')
    expect(result.content).toContain('> 3\t  return "TODO: finish"')
    expect(result.content).toContain(' 4\t}')
  })

  it('returns an empty result without error when nothing matches', async () => {
    const result = await grepTool.execute({ pattern: 'missing', path: tempDir, glob: '**/*.ts' })

    expect(result.isError).toBeUndefined()
    expect(result.content).toBe('No matches found.')
  })

  it('returns an error for invalid regex patterns', async () => {
    const result = await grepTool.execute({ pattern: '[', path: tempDir, glob: '**/*.ts' })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Invalid regex pattern')
  })
})
