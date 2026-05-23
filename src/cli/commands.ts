export interface SlashCommand {
  name: string
  description: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/help', description: '查看帮助和可用命令' },
  { name: '/clear', description: '清空当前会话上下文' },
  { name: '/model', description: '查看或切换模型' },
  { name: '/skills', description: '选择并运行 skill' },
  { name: '/resume', description: '恢复上次会话' },
  { name: '/compact', description: '压缩当前上下文' },
  { name: '/cost', description: '查看本次会话消耗提示' },
  { name: '/exit', description: '退出 ds-code' },
]

export function getSlashCommands(): SlashCommand[] {
  return SLASH_COMMANDS
}

export function matchSlashCommands(input: string): SlashCommand[] {
  if (!input.startsWith('/')) return []
  const commandPart = input.split(/\s+/)[0] ?? input
  return getSlashCommands().filter((command) => command.name.startsWith(commandPart))
}
