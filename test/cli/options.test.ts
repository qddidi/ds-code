import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'
import { readOption, resolveCliOptions } from '../../src/cli/options.js'

describe('CLI options', () => {
  it('lets environment API key override config', () => {
    const options = resolveCliOptions([], { ...DEFAULT_CONFIG, apiKey: 'sk-config' }, { DEEPSEEK_API_KEY: 'sk-env' })

    expect(options.provider).toBe('deepseek')
    expect(options.apiKey).toBe('sk-env')
  })

  it('prefers OPENAI_API_KEY for OpenAI and custom providers', () => {
    const openaiOptions = resolveCliOptions(['--provider', 'openai'], DEFAULT_CONFIG, {
      DEEPSEEK_API_KEY: 'sk-deepseek',
      OPENAI_API_KEY: 'sk-openai',
    })
    const customOptions = resolveCliOptions(['--provider', 'custom'], DEFAULT_CONFIG, {
      DEEPSEEK_API_KEY: 'sk-deepseek',
      OPENAI_API_KEY: 'sk-openai',
    })

    expect(openaiOptions.provider).toBe('openai')
    expect(openaiOptions.apiKey).toBe('sk-openai')
    expect(customOptions.provider).toBe('custom')
    expect(customOptions.apiKey).toBe('sk-openai')
  })

  it('uses CLI provider, model, and base URL before config', () => {
    const options = resolveCliOptions([
      '--provider', 'custom',
      '--model', 'openai/gpt-4o',
      '--base-url', 'https://relay.example.com',
    ], { ...DEFAULT_CONFIG, model: 'deepseek-v4-flash' }, {})

    expect(options.provider).toBe('custom')
    expect(options.model).toBe('openai/gpt-4o')
    expect(options.baseUrl).toBe('https://relay.example.com')
  })

  it('reads prompt and resume flag from args', () => {
    const options = resolveCliOptions(['--resume', '--model', 'flash', 'fix', 'bug'], DEFAULT_CONFIG, {})

    expect(options.resume).toBe(true)
    expect(options.initialPrompt).toBe('fix bug')
  })

  it('passes configured allowed commands through to the app options', () => {
    const options = resolveCliOptions([], {
      ...DEFAULT_CONFIG,
      permissions: { allowedCommands: ['git status', 'pnpm test*'], allowAllCommands: true },
    }, {})

    expect(options.allowedCommands).toEqual(['git status', 'pnpm test*'])
    expect(options.allowAllCommands).toBe(true)
  })

  it('passes skill options through to the app options', () => {
    const options = resolveCliOptions([], {
      ...DEFAULT_CONFIG,
      skills: { enabled: false, autoMatch: false, autoMatchModel: false },
    }, {})

    expect(options.skillsEnabled).toBe(false)
    expect(options.skillsAutoMatch).toBe(false)
    expect(options.skillsAutoMatchModel).toBe(false)
  })

  it('passes timeout through to the app options', () => {
    const options = resolveCliOptions([], { ...DEFAULT_CONFIG, timeout: 300_000 }, {})

    expect(options.timeout).toBe(300_000)
  })

  it('reads named options', () => {
    expect(readOption(['--model', 'pro'], '--model')).toBe('pro')
    expect(readOption(['--base-url', 'https://relay.example.com'], '--base-url')).toBe('https://relay.example.com')
    expect(readOption([], '--model')).toBeUndefined()
  })
})
