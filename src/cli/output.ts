import { Marked } from 'marked'
import { markedTerminal } from 'marked-terminal'
import chalk from 'chalk'

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
  return `${chalk.dim('┌')} ${chalk.yellow('⚡')} ${chalk.bold(name)} ${chalk.dim(truncate(args, 60))}`
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
