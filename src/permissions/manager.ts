import type { Tool } from '../tools/types.js'
import {
  commandMatchesPattern,
  defaultDecisionForTool,
  isDangerousBashCommand,
  type PermissionDecision,
} from './rules.js'

export type PermissionResponse = 'allow_once' | 'allow_always' | 'deny'

export interface PermissionManagerOptions {
  allowedCommands?: string[]
  confirm?: (request: PermissionRequest) => Promise<PermissionResponse>
}

export interface PermissionRequest {
  toolName: string
  args: Record<string, unknown>
  reason: string
}

export interface PermissionResult {
  decision: PermissionDecision
  reason: string
}

export class PermissionManager {
  private allowedCommands: string[]
  private alwaysAllowedTools = new Set<string>()
  private alwaysAllowedBashCommands: string[] = []
  private confirm?: (request: PermissionRequest) => Promise<PermissionResponse>

  constructor(options: PermissionManagerOptions = {}) {
    this.allowedCommands = options.allowedCommands ?? []
    this.confirm = options.confirm
  }

  async check(tool: Tool, args: Record<string, unknown>): Promise<PermissionResult> {
    if (tool.name !== 'bash' && this.alwaysAllowedTools.has(tool.name)) {
      return { decision: 'allow', reason: 'Always allowed' }
    }

    const decision = this.evaluate(tool, args)
    if (decision.decision !== 'confirm') return decision
    if (!this.confirm) return decision

    const response = await this.confirm({
      toolName: tool.name,
      args,
      reason: decision.reason,
    })

    if (response === 'allow_always') {
      if (tool.name === 'bash') {
        this.alwaysAllowedBashCommands.push(String(args.command ?? ''))
      } else {
        this.alwaysAllowedTools.add(tool.name)
      }
      return { decision: 'allow', reason: 'Always allowed' }
    }

    if (response === 'allow_once') {
      return { decision: 'allow', reason: 'Allowed once' }
    }

    return { decision: 'deny', reason: 'Denied by user' }
  }

  private evaluate(tool: Tool, args: Record<string, unknown>): PermissionResult {
    if (tool.name === 'bash') {
      const command = String(args.command ?? '')

      if (isDangerousBashCommand(command)) {
        return { decision: 'deny', reason: 'Dangerous command denied' }
      }

      if (this.alwaysAllowedBashCommands.some((pattern) => commandMatchesPattern(command, pattern))) {
        return { decision: 'allow', reason: 'Command was always allowed' }
      }

      if (this.allowedCommands.some((pattern) => commandMatchesPattern(command, pattern))) {
        return { decision: 'allow', reason: 'Command is allowed by configuration' }
      }
    }

    const decision = defaultDecisionForTool(tool.name, tool.requiresPermission)
    return {
      decision,
      reason: decision === 'allow' ? 'Tool does not require permission' : 'Tool requires confirmation',
    }
  }
}
