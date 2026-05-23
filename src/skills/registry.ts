import type { SkillMetadata, SkillWarning } from './types.js'

export class SkillRegistry {
  private skills: SkillMetadata[]
  private warnings: SkillWarning[]

  constructor(skills: SkillMetadata[], warnings: SkillWarning[] = []) {
    this.skills = [...skills].sort((a, b) => a.name.localeCompare(b.name))
    this.warnings = [...warnings]
  }

  list(): SkillMetadata[] {
    return [...this.skills]
  }

  get(name: string): SkillMetadata | undefined {
    return this.skills.find((skill) => skill.name === name)
  }

  getWarnings(): SkillWarning[] {
    return [...this.warnings]
  }
}
