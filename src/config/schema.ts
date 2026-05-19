export interface DsCodeConfig {
  apiKey?: string
  baseUrl: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  permissions: {
    allowedCommands: string[]
  }
}

export type PartialDsCodeConfig = Partial<{
  apiKey: string
  baseUrl: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
  permissions: Partial<{
    allowedCommands: string[]
  }>
}>
