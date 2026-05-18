import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Spinner } from '../../src/cli/spinner.js'

describe('Spinner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts and sets isSpinning to true', () => {
    const spinner = new Spinner()
    expect(spinner.isSpinning).toBe(false)

    spinner.start()
    expect(spinner.isSpinning).toBe(true)

    spinner.stop()
  })

  it('stops and sets isSpinning to false', () => {
    const spinner = new Spinner()
    spinner.start()
    spinner.stop()
    expect(spinner.isSpinning).toBe(false)
  })

  it('does not double-start', () => {
    const spinner = new Spinner()
    spinner.start()
    spinner.start() // should be no-op
    expect(spinner.isSpinning).toBe(true)
    spinner.stop()
  })

  it('stop is safe to call when not spinning', () => {
    const spinner = new Spinner()
    expect(() => spinner.stop()).not.toThrow()
  })

  it('writes to stderr on interval', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const spinner = new Spinner('Loading...')

    spinner.start()
    vi.advanceTimersByTime(160) // 2 frames at 80ms
    spinner.stop()

    expect(writeSpy).toHaveBeenCalled()
    const calls = writeSpy.mock.calls.map((c) => String(c[0]))
    expect(calls.some((c) => c.includes('Loading...'))).toBe(true)

    writeSpy.mockRestore()
  })
})
