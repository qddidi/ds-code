import chalk from 'chalk'
import { matchSlashCommands, renderSlashCommandSuggestions, clampSelection } from './commands.js'

export interface SlashDropdownResult {
  handled: boolean
  command?: string
}

export async function openSlashDropdown(initialInput = '/'): Promise<SlashDropdownResult> {
  const input = process.stdin
  const output = process.stdout
  const wasRaw = input.isRaw
  const previousEncoding = input.readableEncoding
  const previousRawListeners = input.rawListeners('data') as Array<(...args: unknown[]) => void>

  for (const listener of previousRawListeners) {
    input.off('data', listener)
  }

  if (input.isTTY) input.setRawMode(true)
  input.setEncoding('utf8')
  input.resume()

  let query = initialInput.startsWith('/') ? initialInput : '/'
  let selectedIndex = 0
  let renderedLines = 0

  return new Promise((resolve) => {
    const cleanup = (result: SlashDropdownResult): void => {
      clear(renderedLines)
      input.off('data', onData)
      for (const listener of previousRawListeners) {
        input.on('data', listener)
      }
      if (input.isTTY) input.setRawMode(wasRaw)
      input.setEncoding(previousEncoding ?? undefined)
      resolve(result)
    }

    const render = (): void => {
      const matches = matchSlashCommands(query)
      selectedIndex = clampSelection(selectedIndex, matches.length)
      const body = renderSlashCommandSuggestions(matches, selectedIndex)
      const lines = [
        `${chalk.blue('>')} ${query}`,
        body,
        chalk.dim('  ↑/↓ 选择 · Enter 确认 · Esc 取消'),
      ]
      clear(renderedLines)
      output.write(`\r${lines.join('\n')}\n`)
      renderedLines = lines.reduce((count, line) => count + line.split('\n').length, 0)
    }

    const onData = (chunk: string): void => {
      if (chunk === '') {
        cleanup({ handled: false })
        process.emit('SIGINT')
        return
      }

      if (chunk === '') {
        cleanup({ handled: true })
        return
      }

      if (chunk === '[A') {
        selectedIndex = clampSelection(selectedIndex - 1, matchSlashCommands(query).length)
        render()
        return
      }

      if (chunk === '[B') {
        selectedIndex = clampSelection(selectedIndex + 1, matchSlashCommands(query).length)
        render()
        return
      }

      if (chunk === '\r' || chunk === '\n') {
        const matches = matchSlashCommands(query)
        const selected = matches[clampSelection(selectedIndex, matches.length)]
        cleanup(selected ? { handled: true, command: selected.name } : { handled: true })
        return
      }

      if (chunk === '\t') {
        const matches = matchSlashCommands(query)
        const selected = matches[clampSelection(selectedIndex, matches.length)]
        if (selected) {
          query = selected.name
          selectedIndex = 0
          render()
        }
        return
      }

      if (chunk === '' || chunk === '\b') {
        if (query.length > 1) {
          query = query.slice(0, -1)
          selectedIndex = 0
          render()
        }
        return
      }

      if (/^[\x20-\x7E]$/.test(chunk)) {
        query += chunk
        selectedIndex = 0
        render()
      }
    }

    input.on('data', onData)
    render()
  })
}

function clear(lines: number): void {
  if (lines > 0) {
    process.stdout.write(`\r\x1b[0J\x1b[${lines - 1}A\r\x1b[0J`)
  }
}
