import type { ChatCompletionResponse, ChatMessage } from '../api/types.js'
import { systemMessage, userMessage } from '../core/message.js'
import type { SkillMetadata } from './types.js'

export interface SkillMatchClient {
  chat(messages: ChatMessage[]): Promise<ChatCompletionResponse>
}

interface SkillMatchResponse {
  skill: string | null
}

export function matchSkill(input: string, skills: SkillMetadata[]): SkillMetadata | null {
  const normalizedInput = normalize(input)
  if (!normalizedInput || skills.length === 0) return null

  const directMatch = skills.find((skill) => isDirectMatch(normalizedInput, skill))
  if (directMatch) return directMatch

  const matches = skills.filter((skill) => metadataMatches(normalizedInput, skill))
  return matches.length === 1 ? matches[0]! : null
}

export async function matchSkillWithModel(input: string, skills: SkillMetadata[], client: SkillMatchClient): Promise<SkillMetadata | null> {
  if (!input.trim() || skills.length === 0) return null

  try {
    const response = await client.chat([
      systemMessage('Decide whether the user request clearly matches exactly one available skill. Return only JSON in the form {"skill":"name"} or {"skill":null}. Return null when the request is ambiguous, unrelated, or does not strongly match a skill.'),
      userMessage(formatSkillMatchRequest(input, skills)),
    ])
    const content = response.choices[0]?.message.content
    if (!content) return null

    const parsed = parseSkillMatchResponse(content)
    if (!parsed?.skill) return null
    return skills.find((skill) => skill.name === parsed.skill) ?? null
  } catch {
    return null
  }
}

function isDirectMatch(input: string, skill: SkillMetadata): boolean {
  const name = normalize(skill.name)
  const slashName = `/${name}`
  return input === name || input === slashName || input.startsWith(`${slashName} `)
}

function metadataMatches(input: string, skill: SkillMetadata): boolean {
  const tokens = collectTokens(skill)
  if (tokens.length === 0) return false
  const matched = tokens.filter((token) => input.includes(token))
  return matched.length >= Math.min(2, tokens.length)
}

function collectTokens(skill: SkillMetadata): string[] {
  return unique([
    ...splitWords(skill.name),
    ...splitWords(skill.description),
  ].filter((token) => token.length >= 4))
}

function splitWords(value: string): string[] {
  return normalize(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function formatSkillMatchRequest(input: string, skills: SkillMetadata[]): string {
  return [
    'User request:',
    input,
    '',
    'Available skills:',
    ...skills.map((skill) => `- ${skill.name}: ${skill.description}`),
  ].join('\n')
}

function parseSkillMatchResponse(content: string): SkillMatchResponse | null {
  const parsed: unknown = JSON.parse(content)
  if (!isRecord(parsed)) return null
  const skill = parsed.skill
  if (skill === null || typeof skill === 'string') return { skill }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}
