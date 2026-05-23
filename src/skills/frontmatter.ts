import type { SkillAllowedTool, SkillMetadata, SkillWarning } from './types.js'

export interface ParsedSkillFile {
  fields: Record<string, string | string[]>
  body: string
  warnings: string[]
}

export function parseSkillFile(content: string): ParsedSkillFile {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return { fields: {}, body: content, warnings: ['Missing frontmatter'] }
  }

  const firstLineEnd = content.indexOf('\n')
  const markerStart = content.indexOf('\n---', firstLineEnd)
  if (markerStart === -1) {
    return { fields: {}, body: content, warnings: ['Unclosed frontmatter'] }
  }

  const markerLineEnd = content.indexOf('\n', markerStart + 1)
  const frontmatter = content.slice(firstLineEnd + 1, markerStart)
  const body = markerLineEnd === -1 ? '' : content.slice(markerLineEnd + 1)
  const warnings: string[] = []
  const fields: Record<string, string | string[]> = {}
  const lines = frontmatter.replace(/\r\n/g, '\n').split('\n')
  let currentListKey: string | null = null

  for (const line of lines) {
    if (!line.trim()) continue
    const listMatch = line.match(/^\s+-\s*(.*)$/)
    if (listMatch && currentListKey) {
      const value = listMatch[1]?.trim() ?? ''
      const list = fields[currentListKey]
      if (Array.isArray(list)) list.push(value)
      continue
    }

    const fieldMatch = line.match(/^([a-zA-Z-]+):\s*(.*)$/)
    if (!fieldMatch) {
      warnings.push(`Invalid frontmatter line: ${line}`)
      currentListKey = null
      continue
    }

    const key = fieldMatch[1]!
    const value = fieldMatch[2]?.trim() ?? ''
    if (!isKnownField(key)) {
      warnings.push(`Unknown frontmatter field: ${key}`)
      currentListKey = null
      continue
    }

    if (value === '') {
      fields[key] = []
      currentListKey = key
    } else {
      fields[key] = value
      currentListKey = null
    }
  }

  return { fields, body, warnings }
}

export function buildSkillMetadata(args: {
  fields: Record<string, string | string[]>
  warnings: string[]
  source: SkillMetadata['source']
  directory: string
  skillFile: string
  directoryName: string
}): SkillMetadata | null {
  const warnings: SkillWarning[] = args.warnings.map((message) => ({ path: args.skillFile, message }))
  const name = scalarField(args.fields.name)
  const description = scalarField(args.fields.description)

  if (!name) warnings.push({ path: args.skillFile, message: 'Missing required field: name' })
  if (!description) warnings.push({ path: args.skillFile, message: 'Missing required field: description' })
  if (name && !/^[a-z0-9-]+$/.test(name)) warnings.push({ path: args.skillFile, message: `Invalid skill name: ${name}` })
  if (name && name !== args.directoryName) warnings.push({ path: args.skillFile, message: `Skill name must match directory name: ${args.directoryName}` })

  const allowedTools = parseAllowedTools(args.fields['allowed-tools'], args.skillFile, warnings)
  const referencePaths = parseReferencePaths(args.fields.references, args.skillFile, warnings)

  if (!name || !description || !/^[a-z0-9-]+$/.test(name) || name !== args.directoryName) {
    return null
  }

  return {
    name,
    description,
    source: args.source,
    directory: args.directory,
    skillFile: args.skillFile,
    allowedTools,
    referencePaths,
    warnings,
  }
}

export function parseAllowedTools(value: string | string[] | undefined, path: string, warnings: SkillWarning[]): SkillAllowedTool[] {
  const entries = listField(value)
  const allowedTools: SkillAllowedTool[] = []
  for (const entry of entries) {
    if (!entry) {
      warnings.push({ path, message: 'Invalid empty allowed-tools entry' })
      continue
    }
    if (entry.startsWith('bash:')) {
      const command = entry.slice('bash:'.length).trim()
      if (!command) {
        warnings.push({ path, message: 'Invalid empty bash allowed-tools command' })
        continue
      }
      allowedTools.push({ tool: 'bash', command })
      continue
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(entry)) {
      warnings.push({ path, message: `Invalid allowed-tools entry: ${entry}` })
      continue
    }
    allowedTools.push({ tool: entry })
  }
  return allowedTools
}

export function parseReferencePaths(value: string | string[] | undefined, path: string, warnings: SkillWarning[]): string[] {
  const entries = listField(value)
  const references: string[] = []
  for (const entry of entries) {
    if (!isSafeRelativePath(entry)) {
      warnings.push({ path, message: `Invalid reference path: ${entry}` })
      continue
    }
    references.push(entry.replace(/\\/g, '/'))
  }
  return references
}

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\')) return false
  if (/^[a-zA-Z]:/.test(path)) return false
  const parts = path.replace(/\\/g, '/').split('/')
  return parts.every((part) => part !== '' && part !== '.' && part !== '..')
}

function scalarField(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function listField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim())
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

function isKnownField(field: string): boolean {
  return field === 'name' || field === 'description' || field === 'allowed-tools' || field === 'references'
}
