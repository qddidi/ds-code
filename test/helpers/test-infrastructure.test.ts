import { describe, it, expect, afterEach } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { DeepSeekClient } from '../../src/api/deepseek.js'
import { readTool } from '../../src/tools/read.js'
import { createMockApiServer, type MockApiServer } from '../helpers/mock-api.js'
import { copyFixture, createTempDir, type TempDirHandle } from '../helpers/temp-dir.js'
import { expectToolError, expectToolSuccess } from '../helpers/test-tools.js'

const fixturesDir = resolve('test', 'fixtures')

describe('test infrastructure', () => {
  const handles: TempDirHandle[] = []
  const servers: MockApiServer[] = []

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()))
    await Promise.all(handles.splice(0).map((handle) => handle.cleanup()))
  })

  it('copies fixture projects into isolated temp directories', async () => {
    const fixture = await copyFixture(join(fixturesDir, 'sample-project'))
    handles.push(fixture)

    const packageJson = await readFile(join(fixture.path, 'package.json'), 'utf-8')

    expect(JSON.parse(packageJson).name).toBe('sample-project')
  })

  it('serves mock API responses and records requests', async () => {
    const response = JSON.parse(await readFile(join(fixturesDir, 'api-responses', 'chat-completion.json'), 'utf-8'))
    const server = await createMockApiServer([response])
    servers.push(server)

    const client = new DeepSeekClient({ apiKey: 'sk-test', baseUrl: server.baseUrl })
    const result = await client.chat([{ role: 'user', content: 'hello' }])

    expect(result.choices[0]?.message.content).toBe('Hello from mock API')
    expect(server.requests).toHaveLength(1)
    expect(server.requests[0]?.url).toBe('/v1/chat/completions')
  })

  it('provides temp directory cleanup helpers', async () => {
    const handle = await createTempDir()
    handles.push(handle)

    expect(handle.path).toContain('ds-test-')
  })

  it('provides tool assertion helpers', async () => {
    const fixture = await copyFixture(join(fixturesDir, 'sample-project'))
    handles.push(fixture)

    const success = await readTool.execute({ file_path: join(fixture.path, 'README.md') })
    const failure = await readTool.execute({ file_path: join(fixture.path, 'missing.md') })

    expect(expectToolSuccess(success)).toContain('Sample Project')
    expect(expectToolError(failure)).toContain('File not found')
  })
})
