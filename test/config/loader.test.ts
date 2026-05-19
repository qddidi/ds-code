import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'
import { ConfigError, loadConfig, mergeConfig, readConfigFile, validateConfig } from '../../src/config/loader.js'

describe('config loader', () => {
  let tempDir: string
  let homeDir: string
  let projectDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-config-'))
    homeDir = join(tempDir, 'home')
    projectDir = join(tempDir, 'project')
    await mkdir(homeDir, { recursive: true })
    await mkdir(projectDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('returns defaults when no config files exist', async () => {
    const config = await loadConfig({ homeDir, projectDir })

    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('loads global config JSON', async () => {
    await mkdir(join(homeDir, '.ds-code'), { recursive: true })
    await writeFile(join(homeDir, '.ds-code', 'config.json'), JSON.stringify({ apiKey: 'sk-test', model: 'deepseek-reasoner' }))

    const config = await loadConfig({ homeDir, projectDir })

    expect(config.apiKey).toBe('sk-test')
    expect(config.model).toBe('deepseek-reasoner')
    expect(config.baseUrl).toBe(DEFAULT_CONFIG.baseUrl)
  })

  it('lets project config override global config', async () => {
    await mkdir(join(homeDir, '.ds-code'), { recursive: true })
    await mkdir(join(projectDir, '.ds-code'), { recursive: true })
    await writeFile(join(homeDir, '.ds-code', 'config.json'), JSON.stringify({ model: 'deepseek-v4-pro', temperature: 0.1 }))
    await writeFile(join(projectDir, '.ds-code', 'settings.json'), JSON.stringify({ model: 'deepseek-reasoner' }))

    const config = await loadConfig({ homeDir, projectDir })

    expect(config.model).toBe('deepseek-reasoner')
    expect(config.temperature).toBe(0.1)
  })

  it('deep merges objects and replaces arrays', () => {
    const merged = mergeConfig({
      ...DEFAULT_CONFIG,
      permissions: { allowedCommands: ['npm test', 'git status'] },
    }, {
      permissions: { allowedCommands: ['pnpm test'] },
    })

    expect(merged.permissions.allowedCommands).toEqual(['pnpm test'])
    expect(merged.model).toBe(DEFAULT_CONFIG.model)
  })

  it('throws a friendly error for invalid JSON', async () => {
    const filePath = join(tempDir, 'bad.json')
    await writeFile(filePath, '{bad')

    await expect(readConfigFile(filePath)).rejects.toThrow(ConfigError)
    await expect(readConfigFile(filePath)).rejects.toThrow('Invalid JSON in config file')
  })

  it('ignores unknown fields while preserving known fields', () => {
    const config = mergeConfig(DEFAULT_CONFIG, { model: 'deepseek-reasoner', unknown: true } as never)

    expect(config.model).toBe('deepseek-reasoner')
    expect('unknown' in config).toBe(false)
  })

  it('throws for invalid field types', () => {
    expect(() => validateConfig({ ...DEFAULT_CONFIG, temperature: 'abc' } as never)).toThrow(
      'Invalid config field "temperature": expected number',
    )
  })

  it('requires API key when requested', async () => {
    await expect(loadConfig({ homeDir, projectDir, requireApiKey: true })).rejects.toThrow('Missing API key')
  })
})
