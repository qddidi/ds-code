import type { Provider } from '../api/types.js'
import type { DsCodeConfig } from '../config/schema.js'

export interface CliOptions {
  provider: Provider
  apiKey?: string
  model?: string
  baseUrl?: string
  allowedCommands: string[]
  allowAllCommands: boolean
  skillsEnabled: boolean
  skillsAutoMatch: boolean
  initialPrompt?: string
  resume: boolean
}

export function resolveCliOptions(args: string[], config: DsCodeConfig, env: NodeJS.ProcessEnv): CliOptions {
  const provider = (readOption(args, '--provider') ?? config.provider) as Provider
  const apiKey = resolveApiKey(provider, config, env)
  const model = readOption(args, '--model') ?? config.model
  const baseUrl = readOption(args, '--base-url') ?? config.baseUrl
  const allowedCommands = config.permissions.allowedCommands
  const allowAllCommands = config.permissions.allowAllCommands
  const skillsEnabled = config.skills.enabled
  const skillsAutoMatch = config.skills.autoMatch
  const resume = args.includes('--resume')
  const initialPrompt = readInitialPrompt(args)

  return {
    provider,
    ...(apiKey ? { apiKey } : {}),
    model,
    baseUrl,
    allowedCommands,
    allowAllCommands,
    skillsEnabled,
    skillsAutoMatch,
    ...(initialPrompt ? { initialPrompt } : {}),
    resume,
  }
}

export function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

function resolveApiKey(provider: Provider, config: DsCodeConfig, env: NodeJS.ProcessEnv): string | undefined {
  if (provider === 'openai' || provider === 'custom') return env.OPENAI_API_KEY ?? env.DEEPSEEK_API_KEY ?? config.apiKey
  return env.DEEPSEEK_API_KEY ?? env.OPENAI_API_KEY ?? config.apiKey
}

function readInitialPrompt(args: string[]): string | undefined {
  const positionalArgs = args.filter((arg, i) => {
    if (arg.startsWith('--')) return false
    if (i > 0 && (args[i - 1] === '--model' || args[i - 1] === '--provider' || args[i - 1] === '--base-url')) return false
    return true
  })

  return positionalArgs.length > 0 ? positionalArgs.join(' ') : undefined
}
