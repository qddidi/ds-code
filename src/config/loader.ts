import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { DEFAULT_CONFIG } from './defaults.js'
import type { DsCodeConfig, PartialDsCodeConfig } from './schema.js'

export interface LoadConfigOptions {
  homeDir?: string
  projectDir?: string
  requireApiKey?: boolean
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export async function loadConfig(options: LoadConfigOptions = {}): Promise<DsCodeConfig> {
  const homeDir = options.homeDir ?? homedir()
  const projectDir = options.projectDir ? resolve(options.projectDir) : process.cwd()
  const globalPath = join(homeDir, '.ds-code', 'config.json')
  const projectPath = join(projectDir, '.ds-code', 'settings.json')

  const globalConfig = await readConfigFile(globalPath)
  const projectConfig = await readConfigFile(projectPath)
  const merged = mergeConfig(mergeConfig(DEFAULT_CONFIG, globalConfig), projectConfig)
  const validated = validateConfig(merged)

  if (options.requireApiKey && !validated.apiKey) {
    throw new ConfigError('Missing API key. Set apiKey in ~/.ds-code/config.json or project .ds-code/settings.json.')
  }

  return validated
}

export async function readConfigFile(filePath: string): Promise<PartialDsCodeConfig> {
  let content: string
  try {
    content = await readFile(filePath, 'utf-8')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return {}
    throw err
  }

  try {
    return JSON.parse(content) as PartialDsCodeConfig
  } catch {
    throw new ConfigError(`Invalid JSON in config file: ${filePath}`)
  }
}

export function mergeConfig(base: DsCodeConfig, override: PartialDsCodeConfig): DsCodeConfig {
  return {
    ...base,
    ...pickScalarFields(override),
    permissions: {
      ...base.permissions,
      ...pickPermissionFields(override.permissions),
    },
  }
}

export function validateConfig(config: DsCodeConfig): DsCodeConfig {
  const fields: Array<[keyof DsCodeConfig, string]> = [
    ['provider', 'string'],
    ['apiKey', 'string'],
    ['baseUrl', 'string'],
    ['model', 'string'],
    ['maxTokens', 'number'],
    ['temperature', 'number'],
    ['timeout', 'number'],
  ]

  for (const [field, type] of fields) {
    const value = config[field]
    if (value !== undefined && typeof value !== type) {
      throw new ConfigError(`Invalid config field "${field}": expected ${type}`)
    }
  }

  if (config.provider !== 'deepseek' && config.provider !== 'openai' && config.provider !== 'custom') {
    throw new ConfigError('Invalid config field "provider": expected deepseek, openai, or custom')
  }

  if (!config.permissions || typeof config.permissions !== 'object') {
    throw new ConfigError('Invalid config field "permissions": expected object')
  }

  if (!Array.isArray(config.permissions.allowedCommands)) {
    throw new ConfigError('Invalid config field "permissions.allowedCommands": expected array')
  }

  if (config.permissions.allowedCommands.some((command) => typeof command !== 'string')) {
    throw new ConfigError('Invalid config field "permissions.allowedCommands": expected string array')
  }

  return config
}

function pickScalarFields(config: PartialDsCodeConfig): PartialDsCodeConfig {
  const result: PartialDsCodeConfig = {}
  if ('provider' in config) result.provider = config.provider
  if ('apiKey' in config) result.apiKey = config.apiKey
  if ('baseUrl' in config) result.baseUrl = config.baseUrl
  if ('model' in config) result.model = config.model
  if ('maxTokens' in config) result.maxTokens = config.maxTokens
  if ('temperature' in config) result.temperature = config.temperature
  if ('timeout' in config) result.timeout = config.timeout
  return result
}

function pickPermissionFields(permissions: PartialDsCodeConfig['permissions']): Partial<DsCodeConfig['permissions']> {
  const result: Partial<DsCodeConfig['permissions']> = {}
  if (!permissions) return result
  if ('allowedCommands' in permissions) result.allowedCommands = permissions.allowedCommands
  return result
}
