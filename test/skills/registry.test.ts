import { describe, expect, it } from 'vitest'
import { SkillRegistry } from '../../src/skills/registry.js'
import type { SkillMetadata } from '../../src/skills/types.js'

const skill: SkillMetadata = {
  name: 'review',
  description: 'Review changes',
  source: 'project',
  directory: '/project/.ds-code/skills/review',
  skillFile: '/project/.ds-code/skills/review/SKILL.md',
  allowedTools: [],
  referencePaths: [],
  warnings: [],
}

describe('SkillRegistry', () => {
  it('lists and gets skills by name', () => {
    const registry = new SkillRegistry([skill])

    expect(registry.list()).toEqual([skill])
    expect(registry.get('review')).toEqual(skill)
    expect(registry.get('missing')).toBeUndefined()
  })
})
