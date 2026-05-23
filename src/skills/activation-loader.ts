import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildSkillMetadata, parseSkillFile } from './frontmatter.js'
import type { Skill, SkillMetadata, SkillWarning } from './types.js'

export async function loadSkillActivation(metadata: SkillMetadata): Promise<Skill> {
  const warnings: SkillWarning[] = [...metadata.warnings]
  const content = await readFile(metadata.skillFile, 'utf-8')
  const parsed = parseSkillFile(content)
  const refreshed = buildSkillMetadata({
    fields: parsed.fields,
    warnings: parsed.warnings,
    source: metadata.source,
    directory: metadata.directory,
    skillFile: metadata.skillFile,
    directoryName: metadata.name,
  })

  for (const message of parsed.warnings) warnings.push({ path: metadata.skillFile, message })

  const referencePaths = (refreshed?.referencePaths ?? metadata.referencePaths).filter((path) => {
    const allowed = path.endsWith('.md') || path.endsWith('.txt') || path.endsWith('.json')
    if (!allowed) warnings.push({ path: join(metadata.directory, 'references', path), message: 'Unsupported reference file type' })
    return allowed
  })

  return {
    metadata: refreshed ?? metadata,
    content: parsed.body.trim(),
    referencePaths,
    warnings,
  }
}
