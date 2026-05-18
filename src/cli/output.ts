import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import chalk from 'chalk'
import { basename } from 'node:path'

const marked = new Marked()
marked.use(markedTerminal() as any)

export function renderMarkdown(text: string): string {
  const rendered = marked.parse(text)
  if (typeof rendered === 'string') {
    return rendered.trimEnd()
  }
  return text
}

export function renderToolCall(name: string, args: string): string {
  const summary = toolCallSummary(name, args)
  return `${chalk.dim('┌')} ${chalk.yellow('⚡')} ${summary}`
}

export function toolCallSpinnerText(name: string, args: string): string {
  const parsed = safeParse(args)
  switch (name) {
    case 'read_file':
      return `Reading ${basename(parsed?.file_path ?? 'file')}...`
    case 'write_file':
      return `Writing ${basename(parsed?.file_path ?? 'file')}...`
    case 'edit_file':
      return `Editing ${basename(parsed?.file_path ?? 'file')}...`
    default:
      return 'Running tool...'
  }
}

export function isReadTool(name: string): boolean {
  return name === 'read_file'
}

function toolCallSummary(name: string, args: string): string {
  const parsed = safeParse(args)
  switch (name) {
    case 'read_file':
      return `${chalk.bold('Read')} ${chalk.cyan(parsed?.file_path ?? 'file')}`
    case 'write_file':
      return `${chalk.bold('Write')} ${chalk.cyan(parsed?.file_path ?? 'file')}`
    case 'edit_file':
      return `${chalk.bold('Edit')} ${chalk.cyan(parsed?.file_path ?? 'file')}`
    case 'list_directory':
      return `${chalk.bold('List')} ${chalk.cyan(parsed?.path ?? '.')}`
    case 'glob':
      return `${chalk.bold('Glob')} ${chalk.cyan(parsed?.pattern ?? '*')}`
    case 'grep':
      return `${chalk.bold('Grep')} ${chalk.cyan(parsed?.pattern ?? '')}`
    default:
      return `${chalk.bold(name)} ${chalk.dim(truncate(args, 60))}`
  }
}

function safeParse(args: string): Record<string, string> | null {
  try {
    return JSON.parse(args)
  } catch {
    return null
  }
}

export function renderToolResult(name: string, isError: boolean): string {
  const icon = isError ? chalk.red('✗') : chalk.green('✓')
  return `${chalk.dim('└')} ${icon} ${chalk.dim(name)}`
}

export function renderWelcome(version: string): string {
  return [
    '',
    `${chalk.bold('ds-code')} ${chalk.dim(`v${version}`)}`,
    chalk.dim('Type your message to start. /help for commands, Ctrl+D to exit.'),
    '',
  ].join('\n')
}

export function renderError(message: string): string {
  return `${chalk.red('Error:')} ${message}`
}

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, ' ')
  if (oneLine.length <= max) return oneLine
  return oneLine.slice(0, max - 3) + '...'
}

const MAX_READ_LINES = 3

export class ReadFileTracker {
  private files: string[] = []
  private linesWritten = 0

  add(filePath: string): void {
    this.files.push(basename(filePath))
    if (this.files.length > MAX_READ_LINES) {
      this.files.shift()
    }
  }

  render(): string {
    this.clearPrevious()
    const lines = this.files.map(
      (f) => `  ${chalk.green('✓')} ${chalk.dim(f)}`,
    )
    this.linesWritten = lines.length
    return lines.join('\n')
  }

  reset(): void {
    this.clearPrevious()
    this.files = []
    this.linesWritten = 0
  }

  private clearPrevious(): void {
    if (this.linesWritten > 0) {
      process.stdout.write(`\x1b[${this.linesWritten}A\x1b[0J`)
    }
  }
}
