export type SkillSource = 'global' | 'project'

export interface SkillAllowedTool {
  tool: string
  command?: string
}

export interface SkillWarning {
  path: string
  message: string
}

export interface SkillMetadata {
  name: string
  description: string
  source: SkillSource
  directory: string
  skillFile: string
  allowedTools: SkillAllowedTool[]
  referencePaths: string[]
  warnings: SkillWarning[]
}

export interface Skill {
  metadata: SkillMetadata
  content: string
  referencePaths: string[]
  warnings: SkillWarning[]
}

export interface SkillActivation {
  skill: Skill
  userArgs: string
  allowedTools: SkillAllowedTool[]
}

export interface SkillActivationRequest {
  metadata: SkillMetadata
  userArgs: string
}

export interface LoadSkillMetadataOptions {
  projectDir?: string
  homeDir?: string
}
