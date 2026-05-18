import type { StreamChunk } from './types.js'

export type StreamEvent =
  | { type: 'chunk'; data: StreamChunk }
  | { type: 'done' }
  | { type: 'error'; error: Error }

export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader()
  if (!reader) {
    yield { type: 'error', error: new Error('Response body is null') }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed === '') continue
        if (trimmed === 'data: [DONE]') {
          yield { type: 'done' }
          return
        }
        if (trimmed.startsWith('data: ')) {
          const json = trimmed.slice(6)
          try {
            const chunk = JSON.parse(json) as StreamChunk
            yield { type: 'chunk', data: chunk }
          } catch {
            yield { type: 'error', error: new Error(`Failed to parse SSE chunk: ${json}`) }
          }
        }
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim()
      if (trimmed === 'data: [DONE]') {
        yield { type: 'done' }
      } else if (trimmed.startsWith('data: ')) {
        const json = trimmed.slice(6)
        try {
          const chunk = JSON.parse(json) as StreamChunk
          yield { type: 'chunk', data: chunk }
        } catch {
          yield { type: 'error', error: new Error(`Failed to parse SSE chunk: ${json}`) }
        }
      }
    }

    yield { type: 'done' }
  } catch (err) {
    yield { type: 'error', error: err instanceof Error ? err : new Error(String(err)) }
  } finally {
    reader.releaseLock()
  }
}
