import { AVAILABLE_MODELS, normalizeModel, type DeepSeekModel } from '../api/deepseek.js'

export interface ModelCommandResult {
  ok: boolean
  message: string
  model?: DeepSeekModel
}

export function modelCommand(input: string): string {
  const result = resolveModelCommand(input)
  return result.model ?? result.message
}

export function resolveModelCommand(input: string): ModelCommandResult {
  const modelName = input.trim().split(/\s+/)[1]
  if (!modelName) {
    return { ok: false, message: `Available models: ${AVAILABLE_MODELS.join(', ')}` }
  }

  const model = normalizeModel(modelName)
  if (!model) {
    return { ok: false, message: `Invalid model. Available models: ${AVAILABLE_MODELS.join(', ')}` }
  }

  return { ok: true, model, message: `Switched to: ${model}` }
}
