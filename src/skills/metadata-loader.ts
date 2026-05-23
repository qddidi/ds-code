import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { buildSkillMetadata, parseSkillFile } from './frontmatter.js'
import type { LoadSkillMetadataOptions, SkillMetadata, SkillWarning } from './types.js'

export interface LoadSkillMetadataResult {
  skills: SkillMetadata[]
  warnings: SkillWarning[]
}

export async function loadSkillMetadata(options: LoadSkillMetadataOptions = {}): Promise<LoadSkillMetadataResult> {
  const homeDir = options.homeDir ?? homedir()
  const projectDir = options.projectDir ? resolve(options.projectDir) : process.cwd()
  const warnings: SkillWarning[] = []
  const globalSkills = await scanSkillRoot(join(homeDir, '.ds-code', 'skills'), 'global', warnings)
  const projectSkills = await scanSkillRoot(join(projectDir, '.ds-code', 'skills'), 'project', warnings)
  const byName = new Map<string, SkillMetadata>()

  for (const skill of globalSkills) byName.set(skill.name, skill)
  for (const skill of projectSkills) byName.set(skill.name, skill)

  return { skills: [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)), warnings }
}

async function scanSkillRoot(root: string, source: SkillMetadata['source'], warnings: SkillWarning[]): Promise<SkillMetadata[]> {
  let entries: Awaited<ReturnType<typeof readdir>>
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return []
    warnings.push({ path: root, message: err instanceof Error ? err.message : String(err) })
    return []
  }

  const skills: SkillMetadata[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const directory = join(root, entry.name)
    const skillFile = join(directory, 'SKILL.md')
    try {
      const content = await readFile(skillFile, 'utf-8')
      const parsed = parseSkillFile(content)
      const metadata = buildSkillMetadata({
        fields: parsed.fields,
        warnings: parsed.warnings,
        source,
        directory,
        skillFile,
        directoryName: basename(directory),
      })
      if (metadata) skills.push(metadata)
      else warnings.push(...parsed.warnings.map((message) => ({ path: skillFile, message })))
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') continue
      warnings.push({ path: skillFile, message: err instanceof Error ? err.message : String(err) })
    }
  }
  return skills
}
