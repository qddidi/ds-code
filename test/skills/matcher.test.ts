import { describe, expect, it, vi } from 'vitest'
import { matchSkill, matchSkillWithModel, type SkillMatchClient } from '../../src/skills/matcher.js'
import type { ChatCompletionResponse } from '../../src/api/types.js'
import type { SkillMetadata } from '../../src/skills/types.js'

function skill(name: string, description: string): SkillMetadata {
  return {
    name,
    description,
    source: 'project',
    directory: `/project/.ds-code/skills/${name}`,
    skillFile: `/project/.ds-code/skills/${name}/SKILL.md`,
    allowedTools: [],
    referencePaths: [],
    warnings: [],
  }
}

function response(content: string | null): ChatCompletionResponse {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 1,
    model: 'deepseek-v4-pro',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  }
}

function client(content: string | null): SkillMatchClient {
  return {
    chat: vi.fn().mockResolvedValue(response(content)),
  }
}

describe('matchSkill', () => {
  it('matches an exact skill name', () => {
    const review = skill('review', 'Review pending code changes and report actionable issues')

    expect(matchSkill('review', [review])).toBe(review)
    expect(matchSkill('/review 查看本次提交', [review])).toBe(review)
  })

  it('matches a natural language request using skill metadata', () => {
    const simplify = skill('simplify', 'Review changed code for reuse, quality, and efficiency')

    expect(matchSkill('make this changed code less repetitive and improve quality', [simplify])).toBe(simplify)
  })

  it('returns null when the request does not strongly match a skill', () => {
    const review = skill('review', 'Review pending changes and report actionable issues')

    expect(matchSkill('hello, how are you?', [review])).toBeNull()
  })

  it('returns null when multiple skills match', () => {
    const review = skill('review', 'Review pending changes and report actionable issues')
    const simplify = skill('simplify', 'Review changed code for reuse, quality, and efficiency')

    expect(matchSkill('review changed code quality and report actionable issues', [review, simplify])).toBeNull()
  })

  it('returns null for empty input or empty skill lists', () => {
    const review = skill('review', 'Review pending changes and report actionable issues')

    expect(matchSkill('   ', [review])).toBeNull()
    expect(matchSkill('review this change', [])).toBeNull()
  })
})

describe('matchSkillWithModel', () => {
  it('matches the model selected skill', async () => {
    const review = skill('review', 'Review pending changes and report actionable issues')
    const matchClient = client('{"skill":"review"}')

    await expect(matchSkillWithModel('帮我审查一下这次改动', [review], matchClient)).resolves.toBe(review)
    expect(matchClient.chat).toHaveBeenCalledTimes(1)
  })

  it('returns null for malformed model output', async () => {
    const review = skill('review', 'Review pending changes and report actionable issues')

    await expect(matchSkillWithModel('review this change', [review], client('review'))).resolves.toBeNull()
  })
})
