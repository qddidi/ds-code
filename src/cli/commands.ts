import type { SkillMetadata } from '../skills/types.js'

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
  { name: '/skills', description: '查看可用 skills' },
  { name: '/resume', description: '恢复上次会话' },
  { name: '/memory', description: '查看会话记忆提示' },
  { name: '/compact', description: '压缩当前上下文' },
  { name: '/cost', description: '查看本次会话消耗提示' },
  { name: '/doctor', description: '检查本地运行环境' },
  { name: '/version', description: '查看 ds-code 版本' },
]

export function getSlashCommands(skills: SkillMetadata[] = []): SlashCommand[] {
  const skillCommands = skills.map((skill) => ({
    name: `/${skill.name}`,
    description: skill.description,
  }))
  return [...SLASH_COMMANDS, ...skillCommands]
}

export function matchSlashCommands(input: string, skills: SkillMetadata[] = []): SlashCommand[] {
  if (!input.startsWith('/')) return []
  const commandPart = input.split(/\s+/)[0] ?? input
  return getSlashCommands(skills).filter((command) => command.name.startsWith(commandPart))
}
