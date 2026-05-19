export type ModelAlias = 'pro' | 'flash' | 'reasoner'
export type SupportedModel = 'deepseek-v4-pro' | 'deepseek-v4-flash' | 'deepseek-reasoner'

export function modelCommand(input: string): SupportedModel | string {
  const modelName = input.trim().split(/\s+/)[1]

  if (!modelName) {
    return 'Current models: pro (deepseek-v4-pro), flash (deepseek-v4-flash), reasoner (deepseek-reasoner)'
  }

  if (modelName === 'pro' || modelName === 'chat' || modelName === 'deepseek-chat' || modelName === 'deepseek-v4-pro') return 'deepseek-v4-pro'
  if (modelName === 'flash' || modelName === 'deepseek-v4-flash') return 'deepseek-v4-flash'
  if (modelName === 'reasoner' || modelName === 'deepseek-reasoner') return 'deepseek-reasoner'

  return 'Invalid model. Available models: pro, flash, reasoner, deepseek-v4-pro, deepseek-v4-flash, deepseek-reasoner'
}
