import { describe, expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTempDir } from '../helpers/temp-dir.js'
import { loadSkillMetadata } from '../../src/skills/metadata-loader.js'

async function writeSkill(root: string, name: string, content: string): Promise<void> {
  const dir = join(root, '.ds-code', 'skills', name)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'SKILL.md'), content)
}

describe('loadSkillMetadata', () => {
  it('loads project skill metadata without loading body content', async () => {
    const project = await createTempDir('ds-skills-project-')
    try {
      await writeSkill(project.path, 'review', `---
name: review
description: Review code changes
allowed-tools:
  - read_file
  - bash:git status
references:
  - checklist.md
---
SECRET BODY
`)

      const result = await loadSkillMetadata({ projectDir: project.path, homeDir: join(project.path, 'home') })

      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]).toMatchObject({
        name: 'review',
        description: 'Review code changes',
        source: 'project',
        allowedTools: [{ tool: 'read_file' }, { tool: 'bash', command: 'git status' }],
        referencePaths: ['checklist.md'],
      })
      expect(JSON.stringify(result.skills)).not.toContain('SECRET BODY')
    } finally {
      await project.cleanup()
    }
  })

  it('lets project skills override global skills with the same name', async () => {
    const temp = await createTempDir('ds-skills-override-')
    try {
      const home = join(temp.path, 'home')
      const project = join(temp.path, 'project')
      await writeSkill(home, 'review', `---
name: review
description: Global review
---
Global body
`)
      await writeSkill(project, 'review', `---
name: review
description: Project review
---
Project body
`)

      const result = await loadSkillMetadata({ projectDir: project, homeDir: home })

      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]?.description).toBe('Project review')
      expect(result.skills[0]?.source).toBe('project')
    } finally {
      await temp.cleanup()
    }
  })

  it('ignores invalid skill names and records warnings', async () => {
    const project = await createTempDir('ds-skills-invalid-')
    try {
      await writeSkill(project.path, 'Bad_Name', `---
name: Bad_Name
description: Bad skill
---
Body
`)

      const result = await loadSkillMetadata({ projectDir: project.path, homeDir: join(project.path, 'home') })

      expect(result.skills).toEqual([])
    } finally {
      await project.cleanup()
    }
  })

  it('records invalid allowed tools and references as metadata warnings', async () => {
    const project = await createTempDir('ds-skills-warnings-')
    try {
      await writeSkill(project.path, 'review', `---
name: review
description: Review code changes
allowed-tools:
  - bash:
  - bad tool
references:
  - ../secret.md
---
Body
`)

      const result = await loadSkillMetadata({ projectDir: project.path, homeDir: join(project.path, 'home') })

      expect(result.skills[0]?.warnings.map((warning) => warning.message)).toEqual([
        'Invalid empty bash allowed-tools command',
        'Invalid allowed-tools entry: bad tool',
        'Invalid reference path: ../secret.md',
      ])
    } finally {
      await project.cleanup()
    }
  })
})
