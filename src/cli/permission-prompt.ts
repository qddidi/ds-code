import * as readline from 'node:readline'
import chalk from 'chalk'
import type { PermissionRequest, PermissionResponse } from '../permissions/manager.js'

export function createPermissionConfirm(
  _rl: readline.Interface,
): (request: PermissionRequest) => Promise<PermissionResponse> {
  return (request: PermissionRequest): Promise<PermissionResponse> => {
    return new Promise((resolve) => {
      const summary = formatPermissionRequest(request)
      const prompt = [
        '',
        `${chalk.yellow('⚠')}  ${summary}`,
        chalk.dim(`   ${request.reason}`),
        `   ${chalk.green('[Y]es')} / ${chalk.blue('[A]lways')} / ${chalk.red('[N]o')} `,
      ].join('\n')

      process.stdout.write(prompt)

      const wasRaw = process.stdin.isRaw
      if (process.stdin.isTTY) process.stdin.setRawMode(true)

      const onData = (key: Buffer): void => {
        const ch = key.toString().toLowerCase()
        process.stdin.removeListener('data', onData)
        if (process.stdin.isTTY) process.stdin.setRawMode(wasRaw)
        process.stdout.write('\n')

        if (ch === 'y' || ch === '\r' || ch === '\n') {
          console.log(chalk.dim('   → Allowed'))
          resolve('allow_once')
        } else if (ch === 'a') {
          console.log(chalk.dim('   → Always allowed'))
          resolve('allow_always')
        } else {
          console.log(chalk.dim('   → Denied'))
          resolve('deny')
        }
      }

      process.stdin.on('data', onData)
    })
  }
}

function formatPermissionRequest(request: PermissionRequest): string {
  const { toolName, args } = request

  switch (toolName) {
    case 'write_file':
      return `Write to ${chalk.cyan(String(args.file_path ?? 'file'))}`
    case 'edit_file':
      return `Edit ${chalk.cyan(String(args.file_path ?? 'file'))}`
    case 'bash':
      return `Run: ${chalk.cyan(truncate(String(args.command ?? ''), 60))}`
    default:
      return `Use tool: ${chalk.cyan(toolName)}`
  }
}

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, ' ')
  if (oneLine.length <= max) return oneLine
  return oneLine.slice(0, max - 3) + '...'
}
