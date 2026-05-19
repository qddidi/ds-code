export type ModelAlias = 'chat' | 'reasoner'
export type SupportedModel = 'deepseek-chat' | 'deepseek-reasoner'

export function modelCommand(input: string): SupportedModel | string {
  const modelName = input.trim().split(/\s+/)[1]

  if (!modelName) {
    return 'Current models: chat (deepseek-chat), reasoner (deepseek-reasoner)'
  }

  if (modelName === 'chat' || modelName === 'deepseek-chat') return 'deepseek-chat'
  if (modelName === 'reasoner' || modelName === 'deepseek-reasoner') return 'deepseek-reasoner'

  return 'Invalid model. Available models: chat, reasoner, deepseek-chat, deepseek-reasoner'
}
