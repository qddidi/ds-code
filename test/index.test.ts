import { describe, it, expect } from 'vitest'

describe('M01 — project infrastructure', () => {
  it('exports VERSION string', async () => {
    const { VERSION } = await import('../src/index.js')
    expect(typeof VERSION).toBe('string')
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('exports NAME', async () => {
    const { NAME } = await import('../src/index.js')
    expect(NAME).toBe('ds-code')
  })
})
