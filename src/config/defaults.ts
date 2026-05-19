import type { DsCodeConfig } from './schema.js'

export const DEFAULT_CONFIG: DsCodeConfig = {
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  maxTokens: 4096,
  temperature: 0.2,
  timeout: 120_000,
  permissions: {
    allowedCommands: [],
  },
}
