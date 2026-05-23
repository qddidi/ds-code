import type { Provider } from '../api/types.js'

export interface DsCodeConfig {
  provider: Provider
  apiKey?: string
  baseUrl: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  permissions: {
    allowedCommands: string[]
    allowAllCommands: boolean
  }
}

export type PartialDsCodeConfig = Partial<{
  provider: Provider
  apiKey: string
  baseUrl: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  permissions: Partial<{
    allowedCommands: string[]
    allowAllCommands: boolean
  }>
}>
