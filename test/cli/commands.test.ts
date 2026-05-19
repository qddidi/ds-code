import { describe, it, expect } from 'vitest'
import { SLASH_COMMANDS, matchSlashCommands, renderSlashCommandSuggestions, clampSelection } from '../../src/cli/commands.js'

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

  it('renders suggestions for matched commands and selected item', () => {
    const output = renderSlashCommandSuggestions(matchSlashCommands('/c'), 1)
    expect(output).toContain('/clear')
    expect(output).toContain('/compact')
    expect(output).toContain('压缩当前上下文')
  })

  it('wraps selection index for keyboard navigation', () => {
    expect(clampSelection(-1, 3)).toBe(2)
    expect(clampSelection(3, 3)).toBe(0)
    expect(clampSelection(1, 3)).toBe(1)
    expect(clampSelection(2, 0)).toBe(0)
  })

  it('renders empty state for unmatched slash command', () => {
    expect(renderSlashCommandSuggestions([])).toContain('没有匹配')
  })
})
