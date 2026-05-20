import chalk from 'chalk'

export interface SlashCommand {
  name: string
  description: string
  aliases?: string[]
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/help', description: '查看帮助和可用命令' },
  { name: '/clear', description: '清空当前会话上下文' },
  { name: '/exit', description: '退出 ds-code' },
  { name: '/model', description: '查看或切换模型' },
  { name: '/status', description: '查看当前项目状态' },
  { name: '/tools', description: '查看可用工具' },
  { name: '/resume', description: '恢复上次会话' },
  { name: '/memory', description: '查看会话记忆提示' },
  { name: '/compact', description: '压缩当前上下文' },
  { name: '/cost', description: '查看本次会话消耗提示' },
  { name: '/doctor', description: '检查本地运行环境' },
  { name: '/version', description: '查看 ds-code 版本' },
]

export function matchSlashCommands(input: string): SlashCommand[] {
  if (!input.startsWith('/')) return []
  const commandPart = input.split(/\s+/)[0] ?? input
  return SLASH_COMMANDS.filter((command) => command.name.startsWith(commandPart))
}

export function clampSelection(index: number, count: number): number {
  if (count === 0) return 0
  if (index < 0) return count - 1
  if (index >= count) return 0
  return index
}

export function renderSlashCommandSuggestions(matches: SlashCommand[], selectedIndex = 0): string {
  if (matches.length === 0) {
    return chalk.dim('  没有匹配的 ds-code 命令')
  }

  const selected = clampSelection(selectedIndex, matches.length)
  return matches
    .map((command, index) => {
      const marker = index === selected ? chalk.cyan('›') : ' '
      return `  ${marker} ${chalk.bold(command.name)} ${chalk.dim(command.description)}`
    })
    .join('\n')
}
