import { describe, it, expect, vi } from 'vitest'
import { Agent } from '../../src/core/agent.js'
import { DeepSeekClient } from '../../src/api/deepseek.js'
import { ToolRegistry } from '../../src/tools/registry.js'
import { listDirTool } from '../../src/tools/list-dir.js'

const API_KEY = process.env.DEEPSEEK_API_KEY

describe.skipIf(!API_KEY)('real DeepSeek flow', () => {
  it('handles a tool call round trip', async () => {
    const client = new DeepSeekClient({ apiKey: API_KEY!, timeout: 120_000 })
    const registry = new ToolRegistry()
    registry.register(listDirTool)
    const agent = new Agent(client, registry, {
      systemPrompt: 'You are testing tool use. Use list_dir exactly once on D:\\ds, then answer in one short Chinese sentence.',
      maxIterations: 5,
    })

    const onToolCall = vi.fn()
    const result = await agent.run('介绍一下这个项目', { onToolCall })

    expect(onToolCall).toHaveBeenCalledWith('list_dir', expect.any(String))
    expect(result.length).toBeGreaterThan(0)
  }, 120_000)
})
