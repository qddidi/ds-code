import type { DsCodeConfig } from './schema.js'

export const DEFAULT_CONFIG: DsCodeConfig = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro',
  maxTokens: 4096,
  temperature: 0.2,
  timeout: 120_000,
  permissions: {
    allowedCommands: [],
    allowAllCommands: false,
  },
  skills: {
    enabled: true,
    autoMatch: false,
  },
}
