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

const ALWAYS_ALLOW_PREFIX_PATTERNS: Array<[RegExp, string]> = [
  [/^git\s+status\b/, 'git status*'],
  [/^git\s+diff\b/, 'git diff*'],
  [/^git\s+log\b/, 'git log*'],
  [/^git\s+show\b/, 'git show*'],
  [/^git\s+add\b/, 'git add*'],
  [/^git\s+commit\s+-m\s+/, 'git commit -m *'],
  [/^git\s+commit\s+-am\s+/, 'git commit -am *'],
  [/^pnpm\s+(test|build|lint|typecheck)\b/, 'pnpm $1*'],
  [/^npm\s+run\s+(test|build|lint|typecheck)\b/, 'npm run $1*'],
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

export function patternForAlwaysAllowedCommand(command: string): string {
  for (const [matcher, pattern] of ALWAYS_ALLOW_PREFIX_PATTERNS) {
    const match = command.match(matcher)
    if (!match) continue
    return pattern.replace('$1', match[1] ?? '')
  }

  return command
}
