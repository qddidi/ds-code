import { describe, expect, it } from 'vitest'
import { isBinaryBuffer } from '../../src/utils/binary.js'

describe('isBinaryBuffer', () => {
  it('detects NUL bytes as binary content', () => {
    expect(isBinaryBuffer(Buffer.from([0x41, 0x00, 0x42]))).toBe(true)
  })

  it('treats regular utf-8 text as non-binary', () => {
    expect(isBinaryBuffer(Buffer.from('hello\nworld', 'utf-8'))).toBe(false)
  })
})
