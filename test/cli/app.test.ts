import { describe, expect, it } from 'vitest'
import { formatInitError } from '../../src/cli/app.js'

describe('formatInitError', () => {
  it('uses Error message', () => {
    expect(formatInitError(new Error('bad config'))).toBe('bad config')
  })

  it('stringifies non-error values', () => {
    expect(formatInitError('failed')).toBe('failed')
  })
})
