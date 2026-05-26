import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { editTool } from '../../src/tools/edit.js'

describe('edit_file tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-edit-'))
    process.env.DS_CODE_WORKSPACE_ROOT = tempDir
  })

  afterEach(async () => {
    delete process.env.DS_CODE_WORKSPACE_ROOT
    await rm(tempDir, { recursive: true })
  })

  it('replaces a single occurrence', async () => {
    const filePath = join(tempDir, 'file.ts')
    await writeFile(filePath, 'const x = 1\nconst y = 2\n', 'utf-8')

    const result = await editTool.execute({
      file_path: filePath,
      old_string: 'const x = 1',
      new_string: 'const x = 42',
    })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('diff --git')
    expect(result.content).toContain('--- a/')
    expect(result.content).toContain('+++ b/')
    expect(result.content).toContain('-const x = 1')
    expect(result.content).toContain('+const x = 42')
    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('const x = 42\nconst y = 2\n')
  })

  it('replaces all occurrences with replace_all=true', async () => {
    const filePath = join(tempDir, 'file.ts')
    await writeFile(filePath, 'foo bar foo baz foo\n', 'utf-8')

    const result = await editTool.execute({
      file_path: filePath,
      old_string: 'foo',
      new_string: 'qux',
      replace_all: true,
    })

    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('3 occurrence(s)')
    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('qux bar qux baz qux\n')
  })

  it('returns error when old_string not found', async () => {
    const filePath = join(tempDir, 'file.ts')
    await writeFile(filePath, 'hello world\n', 'utf-8')

    const result = await editTool.execute({
      file_path: filePath,
      old_string: 'nonexistent',
      new_string: 'replacement',
    })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
    expect(result.content).toContain('copy old_string exactly')
  })

  it('returns error when multiple matches without replace_all', async () => {
    const filePath = join(tempDir, 'file.ts')
    await writeFile(filePath, 'aaa\nbbb\naaa\n', 'utf-8')

    const result = await editTool.execute({
      file_path: filePath,
      old_string: 'aaa',
      new_string: 'ccc',
    })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Multiple matches')
  })

  it('returns error for non-existent file', async () => {
    const result = await editTool.execute({
      file_path: join(tempDir, 'nope.ts'),
      old_string: 'x',
      new_string: 'y',
    })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('File not found')
  })

  it('preserves indentation during replacement', async () => {
    const filePath = join(tempDir, 'indent.ts')
    const original = '  if (x) {\n    return 1\n  }\n'
    await writeFile(filePath, original, 'utf-8')

    const result = await editTool.execute({
      file_path: filePath,
      old_string: '    return 1',
      new_string: '    return 2',
    })

    expect(result.isError).toBeUndefined()
    const content = await readFile(filePath, 'utf-8')
    expect(content).toBe('  if (x) {\n    return 2\n  }\n')
  })

  it('rejects edits outside the current project directory', async () => {
    const result = await editTool.execute({
      file_path: resolve('..', 'outside-ds-code-edit-test.txt'),
      old_string: 'old',
      new_string: 'new',
    })

    expect(result.isError).toBe(true)
    expect(result.content).toContain('outside the current project directory')
  })

  it('requires permission', () => {
    expect(editTool.requiresPermission).toBe(true)
  })
})
