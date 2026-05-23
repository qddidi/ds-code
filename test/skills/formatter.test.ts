import { describe, expect, it } from 'vitest'
import { formatSkillActivationPrompt, formatSkillDetail, formatSkillIndex, formatSkillsList } from '../../src/skills/formatter.js'
import type { Skill, SkillMetadata } from '../../src/skills/types.js'

const metadata: SkillMetadata = {
  name: 'review',
  description: 'Review changes',
  source: 'project',
  directory: '/project/.ds-code/skills/review',
  skillFile: '/project/.ds-code/skills/review/SKILL.md',
  allowedTools: [{ tool: 'read_file' }, { tool: 'bash', command: 'git diff' }],
  referencePaths: ['checklist.md'],
  warnings: [],
}

const skill: Skill = {
  metadata,
  content: 'Inspect the diff.',
  referencePaths: ['checklist.md'],
  warnings: [],
}

describe('skill formatters', () => {
  it('formats skill index for system prompt', () => {
    expect(formatSkillIndex([metadata])).toContain('- review: Review changes')
  })

  it('formats skill list and detail', () => {
    expect(formatSkillsList([metadata])).toContain('/review')
    expect(formatSkillDetail(metadata)).toContain('bash:git diff')
  })

  it('formats activation prompt', () => {
    const prompt = formatSkillActivationPrompt(skill, 'focus on permissions')

    expect(prompt).toContain('<activated-skill name="review">')
    expect(prompt).toContain('Inspect the diff.')
    expect(prompt).toContain('- references/checklist.md')
    expect(prompt).toContain('User request:\nfocus on permissions')
  })
})
