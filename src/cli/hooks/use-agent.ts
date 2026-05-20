import { useState, useRef, useCallback } from 'react'
import type { Agent } from '../../core/agent.js'

export type AgentStatus = 'idle' | 'thinking' | 'streaming' | 'tool'

export interface ToolCallInfo {
  name: string
  args: Record<string, unknown>
}

export interface UseAgentResult {
  status: AgentStatus
  streamingText: string
  currentTool: ToolCallInfo | null
  run: (input: string) => Promise<void>
  abort: () => void
}

export function useAgent(agent: Agent): UseAgentResult {
  const [status, setStatus] = useState<AgentStatus>('idle')
  const [streamingText, setStreamingText] = useState('')
  const [currentTool, setCurrentTool] = useState<ToolCallInfo | null>(null)
  const bufferRef = useRef('')
  const abortRef = useRef<AbortController | null>(null)
  const flushRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const run = useCallback(async (input: string) => {
    setStatus('thinking')
    setStreamingText('')
    bufferRef.current = ''
    const controller = new AbortController()
    abortRef.current = controller

    flushRef.current = setInterval(() => {
      if (bufferRef.current) {
        setStreamingText(bufferRef.current)
      }
    }, 16)

    try {
      await agent.run(
        input,
        {
          onContent: (chunk) => {
            if (status !== 'streaming') setStatus('streaming')
            bufferRef.current += chunk
          },
          onThinking: () => {
            setStatus('thinking')
          },
          onToolCall: (name, args) => {
            setStatus('tool')
            let parsed: Record<string, unknown> = {}
            try { parsed = JSON.parse(args) as Record<string, unknown> } catch {}
            setCurrentTool({ name, args: parsed })
          },
          onToolResult: () => {
            setCurrentTool(null)
            setStatus('thinking')
          },
          onMaxIterations: () => {
            // handled by caller
          },
        },
        controller.signal,
      )

      // Final flush
      if (bufferRef.current) {
        setStreamingText(bufferRef.current)
      }
    } finally {
      if (flushRef.current) {
        clearInterval(flushRef.current)
        flushRef.current = null
      }
      abortRef.current = null
      setCurrentTool(null)
      setStatus('idle')
    }
  }, [agent, status])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  return { status, streamingText, currentTool, run, abort }
}
