import { describe, it, expect, vi } from 'vitest'
import { PermissionManager } from '../../src/permissions/manager.js'
import { bashTool } from '../../src/tools/bash.js'
import { editTool } from '../../src/tools/edit.js'
import { globTool } from '../../src/tools/glob.js'
import { grepTool } from '../../src/tools/grep.js'
import { readTool } from '../../src/tools/read.js'
import { writeTool } from '../../src/tools/write.js'

describe('PermissionManager', () => {
  it('allows read-only tools without confirmation', async () => {
    const confirm = vi.fn()
    const manager = new PermissionManager({ confirm })

    await expect(manager.check(readTool, { file_path: 'a.ts' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(globTool, { pattern: '**/*.ts' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(grepTool, { pattern: 'TODO' })).resolves.toMatchObject({ decision: 'allow' })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('requires confirmation for write tools', async () => {
    const confirm = vi.fn(async () => 'allow_once' as const)
    const manager = new PermissionManager({ confirm })

    await expect(manager.check(writeTool, { file_path: 'a.ts', content: 'x' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(editTool, { file_path: 'a.ts', old_string: 'x', new_string: 'y' })).resolves.toMatchObject({ decision: 'allow' })
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('allows configured bash commands without confirmation', async () => {
    const confirm = vi.fn()
    const manager = new PermissionManager({ allowedCommands: ['npm test', 'pnpm test*'], confirm })

    await expect(manager.check(bashTool, { command: 'npm test' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(bashTool, { command: 'pnpm test -- --run' })).resolves.toMatchObject({ decision: 'allow' })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('allows all configured bash commands except dangerous commands', async () => {
    const confirm = vi.fn()
    const manager = new PermissionManager({ allowAllCommands: true, confirm })

    await expect(manager.check(bashTool, { command: 'git push' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(bashTool, { command: 'rm -rf /' })).resolves.toMatchObject({ decision: 'deny' })
    expect(confirm).not.toHaveBeenCalled()
  })

  it('requires confirmation for ordinary bash commands', async () => {
    const confirm = vi.fn(async () => 'allow_once' as const)
    const manager = new PermissionManager({ confirm })

    const result = await manager.check(bashTool, { command: 'ls src' })

    expect(result.decision).toBe('allow')
    expect(confirm).toHaveBeenCalledWith({
      toolName: 'bash',
      args: { command: 'ls src' },
      reason: 'Tool requires confirmation',
    })
  })

  it('denies dangerous bash commands without confirmation', async () => {
    const confirm = vi.fn()
    const manager = new PermissionManager({ allowedCommands: ['rm *'], confirm })

    for (const command of ['rm -rf /', 'rm -rf .', 'git reset --hard HEAD', 'git clean -fdx']) {
      const result = await manager.check(bashTool, { command })
      expect(result.decision).toBe('deny')
    }

    expect(confirm).not.toHaveBeenCalled()
  })

  it('remembers allow always responses for non-bash tools', async () => {
    const confirm = vi.fn(async () => 'allow_always' as const)
    const manager = new PermissionManager({ confirm })

    await expect(manager.check(writeTool, { file_path: 'a.ts', content: 'x' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(writeTool, { file_path: 'b.ts', content: 'y' })).resolves.toMatchObject({ decision: 'allow' })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('remembers allow always responses per bash command pattern', async () => {
    const confirm = vi.fn(async () => 'allow_always' as const)
    const rememberBashCommand = vi.fn(async () => {})
    const manager = new PermissionManager({ confirm, rememberBashCommand })

    await expect(manager.check(bashTool, { command: 'ls src' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(bashTool, { command: 'ls src' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(bashTool, { command: 'git commit -m "chore: update project"' })).resolves.toMatchObject({ decision: 'allow' })
    await expect(manager.check(bashTool, { command: 'git commit -m "fix: bug"' })).resolves.toMatchObject({ decision: 'allow' })
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(rememberBashCommand).toHaveBeenCalledTimes(2)
    expect(rememberBashCommand).toHaveBeenCalledWith('ls src')
    expect(rememberBashCommand).toHaveBeenCalledWith('git commit -m *')
  })

  it('applies deny before allowlist rules', async () => {
    const confirm = vi.fn()
    const manager = new PermissionManager({ allowedCommands: ['rm -rf /'], confirm })

    const result = await manager.check(bashTool, { command: 'rm -rf /' })

    expect(result.decision).toBe('deny')
    expect(confirm).not.toHaveBeenCalled()
  })

  it('allows temporary skill tools only inside the scope', async () => {
    const confirm = vi.fn(async () => 'allow_once' as const)
    const manager = new PermissionManager({ confirm })

    await manager.withTemporaryAllowlist([{ tool: 'write_file' }], async () => {
      await expect(manager.check(writeTool, { file_path: 'a.ts', content: 'x' })).resolves.toMatchObject({ decision: 'allow' })
    })

    await expect(manager.check(writeTool, { file_path: 'b.ts', content: 'x' })).resolves.toMatchObject({ decision: 'allow' })
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('allows temporary skill bash commands with exact matching', async () => {
    const confirm = vi.fn(async () => 'allow_once' as const)
    const manager = new PermissionManager({ confirm })

    await manager.withTemporaryAllowlist([{ tool: 'bash', command: 'git status' }], async () => {
      await expect(manager.check(bashTool, { command: 'git status' })).resolves.toMatchObject({ decision: 'allow' })
      await expect(manager.check(bashTool, { command: 'git status --short' })).resolves.toMatchObject({ decision: 'allow' })
    })

    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('denies dangerous bash commands even when a skill allows them', async () => {
    const confirm = vi.fn()
    const manager = new PermissionManager({ confirm })

    await manager.withTemporaryAllowlist([{ tool: 'bash', command: 'rm -rf /' }], async () => {
      await expect(manager.check(bashTool, { command: 'rm -rf /' })).resolves.toMatchObject({ decision: 'deny' })
    })

    expect(confirm).not.toHaveBeenCalled()
  })
})
