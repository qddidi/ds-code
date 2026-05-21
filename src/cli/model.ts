import { AVAILABLE_MODELS, normalizeModel } from '../api/deepseek.js'
import type { Provider } from '../api/types.js'

export interface ModelCommandResult {
  ok: boolean
  message: string
  model?: string
}

export function modelCommand(input: string, provider: Provider = 'deepseek'): string {
  const result = resolveModelCommand(input, provider)
  return result.model ?? result.message
}

export function resolveModelCommand(input: string, provider: Provider = 'deepseek'): ModelCommandResult {
  const modelName = input.trim().split(/\s+/)[1]
  if (!modelName) {
    if (provider === 'deepseek') return { ok: false, message: `Available models: ${AVAILABLE_MODELS.join(', ')}` }
    return { ok: false, message: 'Use /model <name> to switch models.' }
  }

  const model = normalizeModel(modelName, provider)
  if (!model) {
    if (provider === 'deepseek') return { ok: false, message: `Invalid model. Available models: ${AVAILABLE_MODELS.join(', ')}` }
    return { ok: false, message: 'Invalid model. Model must be a non-empty string.' }
  }

  return { ok: true, model, message: `Switched to: ${model}` }
}
