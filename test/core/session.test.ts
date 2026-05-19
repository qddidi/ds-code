import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SessionStore } from '../../src/core/session.js'
import { assistantMessage, userMessage } from '../../src/core/message.js'

describe('SessionStore', () => {
  let tempDir: string
  let store: SessionStore

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ds-session-'))
    store = new SessionStore(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  it('saves session messages to JSON', async () => {
    const session = await store.create([userMessage('hello')])
    await store.save(session)

    const loaded = await store.load(session.id)

    expect(loaded.messages).toEqual([userMessage('hello')])
  })

  it('restores a complete message history', async () => {
    const messages = [userMessage('hello'), assistantMessage('hi')]
    const session = await store.create(messages)
    await store.save(session)

    const loaded = await store.load(session.id)

    expect(loaded.messages).toEqual(messages)
    expect(loaded.id).toBe(session.id)
  })

  it('lists sessions sorted by updated time descending', async () => {
    const older = await store.create([userMessage('older')])
    const newer = await store.create([userMessage('newer')])
    older.updatedAt = '2026-01-01T00:00:00.000Z'
    newer.updatedAt = '2026-01-02T00:00:00.000Z'
    await writeFile(store.getSessionPath(older.id), JSON.stringify(older), 'utf-8')
    await writeFile(store.getSessionPath(newer.id), JSON.stringify(newer), 'utf-8')

    const sessions = await store.list()

    expect(sessions.map((session) => session.id)).toEqual([newer.id, older.id])
    expect(sessions[0]?.messageCount).toBe(1)
  })

  it('updates session file on autosave', async () => {
    const session = await store.create()
    await store.autosave(session, [userMessage('first')])
    await store.autosave(session, [userMessage('first'), assistantMessage('second')])

    const loaded = await store.load(session.id)

    expect(loaded.messages).toEqual([userMessage('first'), assistantMessage('second')])
  })

  it('skips corrupted session files when listing', async () => {
    await mkdir(tempDir, { recursive: true })
    await writeFile(join(tempDir, 'broken.json'), '{bad', 'utf-8')
    const session = await store.create([userMessage('ok')])
    await store.save(session)

    const sessions = await store.list()

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.id).toBe(session.id)
  })

  it('creates unique session IDs', async () => {
    const ids = new Set<string>()

    for (let i = 0; i < 100; i++) {
      ids.add((await store.create()).id)
    }

    expect(ids.size).toBe(100)
  })
})
