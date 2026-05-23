import { describe, it, expect } from 'vitest'
import { commandMatchesPattern, patternForAlwaysAllowedCommand } from '../../src/permissions/rules.js'

describe('permission rules', () => {
  it('matches exact and prefix command patterns', () => {
    expect(commandMatchesPattern('git status', 'git status')).toBe(true)
    expect(commandMatchesPattern('git status --short', 'git status*')).toBe(true)
    expect(commandMatchesPattern('git diff', 'git status*')).toBe(false)
  })

  it('normalizes selected always-allowed commands to prefix patterns', () => {
    expect(patternForAlwaysAllowedCommand('git status --short')).toBe('git status*')
    expect(patternForAlwaysAllowedCommand('git commit -m "chore: update project"')).toBe('git commit -m *')
    expect(patternForAlwaysAllowedCommand('pnpm test -- --run')).toBe('pnpm test*')
    expect(patternForAlwaysAllowedCommand('npm run build -- --watch')).toBe('npm run build*')
    expect(patternForAlwaysAllowedCommand('ls src')).toBe('ls src')
  })
})
