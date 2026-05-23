import { describe, it, expect } from 'vitest'
import { SLASH_COMMANDS, getSlashCommands, matchSlashCommands } from '../../src/cli/commands.js'

describe('slash commands', () => {
  it('defines only user-facing command palette entries', () => {
    expect(SLASH_COMMANDS.map((command) => command.name)).toEqual([
      '/help',
      '/clear',
      '/model',
      '/skills',
      '/resume',
      '/compact',
      '/cost',
      '/exit',
    ])
  })

  it('matches commands every time the input changes', () => {
    expect(matchSlashCommands('/').map((command) => command.name)).toEqual(getSlashCommands().map((command) => command.name))
    expect(matchSlashCommands('/c').map((command) => command.name)).toEqual(['/clear', '/compact', '/cost'])
    expect(matchSlashCommands('/e').map((command) => command.name)).toEqual(['/exit'])
    expect(matchSlashCommands('/x')).toEqual([])
  })

  it('does not expose dynamic skill commands in slash suggestions', () => {
    expect(getSlashCommands().map((command) => command.name)).not.toContain('/review')
    expect(matchSlashCommands('/r').map((command) => command.name)).toEqual(['/resume'])
  })

  it('only matches slash-prefixed input', () => {
    expect(matchSlashCommands('help')).toEqual([])
  })
})
