import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readTool } from '../../src/tools/read.js'

describe('read_file tool', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-read-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('reads a complete file with line numbers', async () => {
    const filePath = join(tempDir, 'hello.txt')
    await writeFile(filePath, 'line1\nline2\nline3\n', 'utf-8')

    const result = await readTool.execute({ file_path: filePath })
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('1\tline1')
    expect(result.content).toContain('2\tline2')
    expect(result.content).toContain('3\tline3')
  })

  it('reads a line range with offset and limit', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line${i + 1}`)
    const filePath = join(tempDir, 'many.txt')
    await writeFile(filePath, lines.join('\n'), 'utf-8')

    const result = await readTool.execute({ file_path: filePath, offset: 5, limit: 3 })
    expect(result.isError).toBeUndefined()
    expect(result.content).toContain('5\tline5')
    expect(result.content).toContain('6\tline6')
    expect(result.content).toContain('7\tline7')
    expect(result.content).not.toContain('4\tline4')
    expect(result.content).not.toContain('8\tline8')
  })

  it('returns error for non-existent file', async () => {
    const result = await readTool.execute({ file_path: join(tempDir, 'nope.txt') })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('File not found')
  })

  it('detects and rejects binary files', async () => {
    const filePath = join(tempDir, 'binary.bin')
    const buf = Buffer.alloc(100)
    buf[50] = 0
    buf[0] = 0x89
    await writeFile(filePath, buf)

    const result = await readTool.execute({ file_path: filePath })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('binary file')
  })

  it('returns error for directories', async () => {
    const result = await readTool.execute({ file_path: tempDir })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Not a file')
  })

  it('shows total line count in header', async () => {
    const filePath = join(tempDir, 'count.txt')
    await writeFile(filePath, 'a\nb\nc\nd\ne\n', 'utf-8')

    const result = await readTool.execute({ file_path: filePath })
    expect(result.content).toContain('of 6')
  })
})
