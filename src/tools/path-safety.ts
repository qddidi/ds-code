import { homedir } from 'node:os'
import { isAbsolute, normalize, parse, relative, resolve } from 'node:path'

export interface PathSafetyResult {
  ok: boolean
  path: string
  reason?: string
}

const SENSITIVE_UNIX_PREFIXES = [
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/lib',
  '/lib64',
  '/proc',
  '/root',
  '/sbin',
  '/sys',
  '/usr',
  '/var',
]

const SENSITIVE_WINDOWS_SEGMENTS = [
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
]

export function assertSafeWritablePath(filePath: string, cwd = process.cwd()): PathSafetyResult {
  const resolvedPath = resolve(filePath)
  const resolvedCwd = resolve(cwd)

  const sensitiveReason = getSensitivePathReason(filePath) ?? getSensitivePathReason(resolvedPath)
  if (sensitiveReason) {
    return { ok: false, path: resolvedPath, reason: sensitiveReason }
  }

  if (!isPathInside(resolvedPath, resolvedCwd)) {
    return {
      ok: false,
      path: resolvedPath,
      reason: `Refusing to write outside the current project directory: ${resolvedPath}`,
    }
  }

  return { ok: true, path: resolvedPath }
}

export function assertSafeWritablePathForTool(filePath: string): PathSafetyResult {
  const cwd = process.env.DS_CODE_WORKSPACE_ROOT ?? process.cwd()
  return assertSafeWritablePath(filePath, cwd)
}

function isPathInside(child: string, parent: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function getSensitivePathReason(filePath: string): string | undefined {
  const slashNormalized = filePath.replace(/\\/g, '/').toLowerCase()
  for (const prefix of SENSITIVE_UNIX_PREFIXES) {
    if (slashNormalized === prefix || slashNormalized.startsWith(`${prefix}/`)) {
      return `Refusing to write inside sensitive system directory: ${prefix}`
    }
  }

  const normalized = normalize(filePath)
  const lower = normalized.toLowerCase()
  const home = homedir()

  if (home && isPathInside(normalized, resolve(home, '.ssh'))) {
    return `Refusing to write inside sensitive directory: ${resolve(home, '.ssh')}`
  }

  if (lower.includes('\\.ssh\\') || lower.endsWith('\\.ssh')) {
    return `Refusing to write inside sensitive directory: ${filePath}`
  }

  const root = parse(normalized).root
  if (root === '/') {
    for (const prefix of SENSITIVE_UNIX_PREFIXES) {
      if (lower === prefix || lower.startsWith(`${prefix}/`)) {
        return `Refusing to write inside sensitive system directory: ${prefix}`
      }
    }
  }

  const withoutRoot = lower.slice(root.length)
  const firstSegment = withoutRoot.split(/[\\/]/)[0]
  if (firstSegment && SENSITIVE_WINDOWS_SEGMENTS.includes(firstSegment)) {
    return `Refusing to write inside sensitive system directory: ${root}${firstSegment}`
  }

  return undefined
}
