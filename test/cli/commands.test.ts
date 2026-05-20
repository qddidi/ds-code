import { describe, it, expect } from 'vitest'
import { SLASH_COMMANDS, matchSlashCommands } from '../../src/cli/commands.js'

describe('slash commands', () => {
  it('defines ds-code command palette entries', () => {
    expect(SLASH_COMMANDS.map((command) => command.name)).toContain('/help')
    expect(SLASH_COMMANDS.map((command) => command.name)).toContain('/tools')
    expect(SLASH_COMMANDS.map((command) => command.name)).toContain('/model')
    expect(SLASH_COMMANDS.length).toBeGreaterThan(3)
  })

  it('matches commands every time the input changes', () => {
    expect(matchSlashCommands('/').length).toBeGreaterThan(3)
    expect(matchSlashCommands('/c').map((command) => command.name)).toEqual(['/clear', '/compact', '/cost'])
    expect(matchSlashCommands('/e').map((command) => command.name)).toEqual(['/exit'])
    expect(matchSlashCommands('/x')).toEqual([])
  })

  it('only matches slash-prefixed input', () => {
    expect(matchSlashCommands('help')).toEqual([])
  })
})
