import { describe, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTempDir } from '../helpers/temp-dir.js'
import { loadSkillActivation } from '../../src/skills/activation-loader.js'
import type { SkillMetadata } from '../../src/skills/types.js'

async function createMetadata(root: string): Promise<SkillMetadata> {
  const directory = join(root, '.ds-code', 'skills', 'review')
  await mkdir(directory, { recursive: true })
  const skillFile = join(directory, 'SKILL.md')
  await writeFile(skillFile, `---
name: review
description: Review code changes
allowed-tools:
  - bash:git diff
references:
  - checklist.md
  - image.png
---
Follow the checklist.
`)
  return {
    name: 'review',
    description: 'Review code changes',
    source: 'project',
    directory,
    skillFile,
    allowedTools: [{ tool: 'bash', command: 'git diff' }],
    referencePaths: ['checklist.md', 'image.png'],
    warnings: [],
  }
}

describe('loadSkillActivation', () => {
  it('loads skill body only at activation time', async () => {
    const project = await createTempDir('ds-skill-activation-')
    try {
      const metadata = await createMetadata(project.path)

      const skill = await loadSkillActivation(metadata)

      expect(skill.content).toBe('Follow the checklist.')
      expect(skill.referencePaths).toEqual(['checklist.md'])
      expect(skill.warnings.map((warning) => warning.message)).toContain('Unsupported reference file type')
    } finally {
      await project.cleanup()
    }
  })
})
