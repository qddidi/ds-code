import type { DsCodeConfig } from '../config/schema.js'

export interface CliOptions {
  apiKey?: string
  model?: string
  baseUrl?: string
  initialPrompt?: string
  resume: boolean
}

export function resolveCliOptions(args: string[], config: DsCodeConfig, env: NodeJS.ProcessEnv): CliOptions {
  const apiKey = env.DEEPSEEK_API_KEY ?? config.apiKey
  const model = readOption(args, '--model') ?? config.model
  const resume = args.includes('--resume')
  const initialPrompt = readInitialPrompt(args)

  return {
    ...(apiKey ? { apiKey } : {}),
    model,
    baseUrl: config.baseUrl,
    ...(initialPrompt ? { initialPrompt } : {}),
    resume,
  }
}

export function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

function readInitialPrompt(args: string[]): string | undefined {
  const positionalArgs = args.filter((arg, i) => {
    if (arg.startsWith('--')) return false
    if (i > 0 && args[i - 1] === '--model') return false
    return true
  })

  return positionalArgs.length > 0 ? positionalArgs.join(' ') : undefined
}
