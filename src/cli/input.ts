export interface InputResult {
  type: 'message' | 'command' | 'empty' | 'exit'
  content: string
}

export function parseInput(raw: string): InputResult {
  const trimmed = raw.trim()

  if (trimmed === '') {
    return { type: 'empty', content: '' }
  }

  if (trimmed.startsWith('/')) {
    return { type: 'command', content: trimmed }
  }

  return { type: 'message', content: trimmed }
}

export function joinMultiline(lines: string[]): string {
  return lines
    .map((line) => {
      if (line.endsWith('\\')) {
        return line.slice(0, -1)
      }
      return line
    })
    .join('\n')
}
