import { describe, it, expect } from 'vitest'
import { parseSSEStream } from '../../src/api/stream.js'

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let index = 0

  const readable = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!))
        index++
      } else {
        controller.close()
      }
    },
  })

  return { body: readable } as unknown as Response
}

describe('parseSSEStream', () => {
  it('parses single chunk', async () => {
    const chunk = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'deepseek-chat',
      choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
    }

    const response = createStreamResponse([`data: ${JSON.stringify(chunk)}\n\n`])
    const events = []
    for await (const event of parseSSEStream(response)) {
      events.push(event)
    }

    expect(events[0]).toEqual({ type: 'chunk', data: chunk })
  })

  it('parses multiple chunks in one data block', async () => {
    const chunk1 = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'deepseek-chat',
      choices: [{ index: 0, delta: { content: 'Hel' }, finish_reason: null }],
    }
    const chunk2 = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'deepseek-chat',
      choices: [{ index: 0, delta: { content: 'lo' }, finish_reason: null }],
    }

    const response = createStreamResponse([
      `data: ${JSON.stringify(chunk1)}\n\ndata: ${JSON.stringify(chunk2)}\n\n`,
    ])

    const events = []
    for await (const event of parseSSEStream(response)) {
      events.push(event)
    }

    expect(events).toHaveLength(3) // 2 chunks + done
    expect(events[0]).toEqual({ type: 'chunk', data: chunk1 })
    expect(events[1]).toEqual({ type: 'chunk', data: chunk2 })
  })

  it('handles [DONE] signal', async () => {
    const chunk = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'deepseek-chat',
      choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: 'stop' }],
    }

    const response = createStreamResponse([
      `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`,
    ])

    const events = []
    for await (const event of parseSSEStream(response)) {
      events.push(event)
    }

    expect(events).toHaveLength(2)
    expect(events[0]!.type).toBe('chunk')
    expect(events[1]).toEqual({ type: 'done' })
  })

  it('handles split chunks across network packets', async () => {
    const chunk = {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1700000000,
      model: 'deepseek-chat',
      choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
    }

    const json = JSON.stringify(chunk)
    const half = Math.floor(json.length / 2)

    const response = createStreamResponse([
      `data: ${json.slice(0, half)}`,
      `${json.slice(half)}\n\ndata: [DONE]\n\n`,
    ])

    const events = []
    for await (const event of parseSSEStream(response)) {
      events.push(event)
    }

    expect(events[0]).toEqual({ type: 'chunk', data: chunk })
    expect(events[1]).toEqual({ type: 'done' })
  })

  it('yields error on null body', async () => {
    const response = { body: null } as unknown as Response

    const events = []
    for await (const event of parseSSEStream(response)) {
      events.push(event)
    }

    expect(events[0]!.type).toBe('error')
  })

  it('yields error on malformed JSON', async () => {
    const response = createStreamResponse([`data: {invalid json}\n\n`])

    const events = []
    for await (const event of parseSSEStream(response)) {
      events.push(event)
    }

    expect(events[0]!.type).toBe('error')
  })
})
