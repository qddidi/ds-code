export type PermissionDecision = 'allow' | 'confirm' | 'deny'

export interface PermissionRule {
  pattern: string
  decision: PermissionDecision
}

const DANGEROUS_BASH_PATTERNS = [
  /\brm\s+(-[\w-]*r[\w-]*f|-rf|-fr)\s+(\/|\*|~|\.)\s*($|[;&|])/i,
  /\brm\s+(-[\w-]*r|-r)\s+\//i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-[\w-]*f[\w-]*d[\w-]*\b/i,
  /\bdd\s+.*\bof=\/dev\//i,
  /:\(\)\s*\{\s*:\|:/,
]

export function defaultDecisionForTool(toolName: string, requiresPermission: boolean): PermissionDecision {
  if (!requiresPermission) return 'allow'
  if (toolName === 'write_file' || toolName === 'edit_file' || toolName === 'bash') return 'confirm'
  return 'confirm'
}

export function isDangerousBashCommand(command: string): boolean {
  return DANGEROUS_BASH_PATTERNS.some((pattern) => pattern.test(command))
}

export function commandMatchesPattern(command: string, pattern: string): boolean {
  if (pattern.endsWith('*')) return command.startsWith(pattern.slice(0, -1))
  return command === pattern
}
