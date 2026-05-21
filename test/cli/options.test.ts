import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'
import { readOption, resolveCliOptions } from '../../src/cli/options.js'

describe('CLI options', () => {
  it('lets environment API key override config', () => {
    const options = resolveCliOptions([], { ...DEFAULT_CONFIG, apiKey: 'sk-config' }, { DEEPSEEK_API_KEY: 'sk-env' })

    expect(options.apiKey).toBe('sk-env')
  })

  it('uses CLI model before config model', () => {
    const options = resolveCliOptions(['--model', 'reasoner'], { ...DEFAULT_CONFIG, model: 'deepseek-v4-flash' }, {})

    expect(options.model).toBe('reasoner')
  })

  it('reads prompt and resume flag from args', () => {
    const options = resolveCliOptions(['--resume', '--model', 'flash', 'fix', 'bug'], DEFAULT_CONFIG, {})

    expect(options.resume).toBe(true)
    expect(options.initialPrompt).toBe('fix bug')
  })

  it('reads named options', () => {
    expect(readOption(['--model', 'pro'], '--model')).toBe('pro')
    expect(readOption([], '--model')).toBeUndefined()
  })
})
