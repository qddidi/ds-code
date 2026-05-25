import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { assertSafeWritablePath } from '../../src/tools/path-safety.js'

describe('assertSafeWritablePath', () => {
  it('allows paths inside the project directory', () => {
    const cwd = process.cwd()
    const filePath = resolve(cwd, 'src', 'safe.txt')

    expect(assertSafeWritablePath(filePath, cwd)).toEqual({ ok: true, path: filePath })
  })

  it('rejects paths outside the project directory', () => {
    const cwd = resolve('/tmp/project')
    const result = assertSafeWritablePath('/tmp/outside.txt', cwd)

    expect(result.ok).toBe(false)
    expect(result.reason).toContain('outside the current project directory')
  })

  it('rejects unix system directories even if cwd is root', () => {
    const result = assertSafeWritablePath('/etc/hosts', '/')

    expect(result.ok).toBe(false)
    expect(result.reason).toContain('sensitive system directory')
  })

  it('rejects windows system directories even if cwd is the drive root', () => {
    const result = assertSafeWritablePath('C:\\Windows\\System32\\drivers\\etc\\hosts', 'C:\\')

    expect(result.ok).toBe(false)
    expect(result.reason).toContain('sensitive system directory')
  })

  it('rejects ssh directories', () => {
    const cwd = resolve('/tmp/project')
    const result = assertSafeWritablePath(resolve(cwd, '.ssh', 'id_rsa'), cwd)

    expect(result.ok).toBe(false)
    expect(result.reason).toContain('sensitive directory')
  })
})
