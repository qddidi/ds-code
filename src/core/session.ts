import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ChatMessage } from '../api/types.js'

export interface SessionData {
  id: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface SessionSummary {
  id: string
  createdAt: string
  updatedAt: string
  messageCount: number
  filePath: string
}

export class SessionStore {
  private sessionsDir: string

  constructor(sessionsDir = join(homedir(), '.ds-code', 'sessions')) {
    this.sessionsDir = sessionsDir
  }

  async create(messages: ChatMessage[] = []): Promise<SessionData> {
    const now = new Date().toISOString()
    return {
      id: createSessionId(),
      createdAt: now,
      updatedAt: now,
      messages,
    }
  }

  async save(session: SessionData): Promise<void> {
    await mkdir(this.sessionsDir, { recursive: true })
    const updated: SessionData = {
      ...session,
      updatedAt: new Date().toISOString(),
    }
    Object.assign(session, updated)
    await writeFile(this.getSessionPath(session.id), JSON.stringify(updated, null, 2), 'utf-8')
  }

  async load(id: string): Promise<SessionData> {
    const content = await readFile(this.getSessionPath(id), 'utf-8')
    return parseSession(content, this.getSessionPath(id))
  }

  async list(): Promise<SessionSummary[]> {
    let entries: string[]
    try {
      entries = await readdir(this.sessionsDir)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return []
      throw err
    }

    const summaries: SessionSummary[] = []
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const filePath = join(this.sessionsDir, entry)
      try {
        const content = await readFile(filePath, 'utf-8')
        const session = parseSession(content, filePath)
        summaries.push({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messages.length,
          filePath,
        })
      } catch {
        continue
      }
    }

    return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async resumeLatest(): Promise<SessionData | null> {
    const sessions = await this.list()
    const latest = sessions[0]
    if (!latest) return null
    return this.load(latest.id)
  }

  async autosave(session: SessionData, messages: ChatMessage[]): Promise<void> {
    session.messages = messages
    await this.save(session)
  }

  getSessionPath(id: string): string {
    return join(this.sessionsDir, `${id}.json`)
  }
}

function createSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function parseSession(content: string, filePath: string): SessionData {
  const parsed = JSON.parse(content) as SessionData
  if (!parsed.id || !Array.isArray(parsed.messages)) {
    throw new Error(`Invalid session file: ${filePath}`)
  }
  return parsed
}
