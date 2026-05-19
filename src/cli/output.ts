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

export function renderThinking(): string {
  return '正在分析你的请求...'
}

export function renderAfterTool(name: string, isError: boolean): string {
  if (isError) {
    return `${toolActionName(name)} 遇到问题，正在调整下一步...`
  }
  return `${toolActionName(name)} 已完成，正在继续整理结果...`
}

export function renderToolCall(name: string, args: string): string {
  const summary = toolCallSummary(name, args)
  return `${chalk.dim('┌')} ${chalk.yellow('⚡')} ${summary}`
}

export function toolCallSpinnerText(name: string, args: string): string {
  const parsed = safeParse(args)
  switch (name) {
    case 'read_file':
      return `正在读取 ${basename(parsed?.file_path ?? 'file')}...`
    case 'write_file':
      return `正在写入 ${basename(parsed?.file_path ?? 'file')}...`
    case 'edit_file':
      return `正在编辑 ${basename(parsed?.file_path ?? 'file')}...`
    case 'list_dir':
      return `正在查看 ${parsed?.path ?? '.'}...`
    case 'glob':
      return `正在查找 ${parsed?.pattern ?? '*'}...`
    case 'grep':
      return `正在搜索 ${parsed?.pattern ?? ''}...`
    case 'bash':
      return '正在执行命令...'
    default:
      return '正在使用工具...'
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
    case 'list_dir':
      return `${chalk.bold('List')} ${chalk.cyan(parsed?.path ?? '.')}`
    case 'glob':
      return `${chalk.bold('Glob')} ${chalk.cyan(parsed?.pattern ?? '*')}`
    case 'grep':
      return `${chalk.bold('Grep')} ${chalk.cyan(parsed?.pattern ?? '')}`
    case 'bash':
      return `${chalk.bold('Bash')} ${chalk.cyan(truncate(parsed?.command ?? '', 60))}`
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

function toolActionName(name: string): string {
  switch (name) {
    case 'read_file':
      return '读取文件'
    case 'write_file':
      return '写入文件'
    case 'edit_file':
      return '编辑文件'
    case 'list_dir':
      return '查看目录'
    case 'glob':
      return '查找文件'
    case 'grep':
      return '搜索内容'
    case 'bash':
      return '执行命令'
    default:
      return `工具 ${name}`
  }
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
