import React, { useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import TextInput from 'ink-text-input'
import { MessageList, type DisplayMessage } from './components/message-list.js'
import { StreamingText } from './components/streaming-text.js'
import { StatusIndicator } from './components/status-indicator.js'
import { ToolCallDisplay } from './components/tool-call.js'
import { PermissionPrompt } from './components/permission-prompt.js'
import { Autocomplete } from './components/autocomplete.js'
import { Agent } from '../core/agent.js'
import { DeepSeekClient, AVAILABLE_MODELS } from '../api/deepseek.js'
import type { Provider } from '../api/types.js'
import { ToolRegistry } from '../tools/registry.js'
import { readTool } from '../tools/read.js'
import { writeTool } from '../tools/write.js'
import { editTool } from '../tools/edit.js'
import { globTool } from '../tools/glob.js'
import { grepTool } from '../tools/grep.js'
import { listDirTool } from '../tools/list-dir.js'
import { bashTool } from '../tools/bash.js'
import { PermissionManager } from '../permissions/manager.js'
import { SessionStore, type SessionData } from '../core/session.js'
import { matchSlashCommands, SLASH_COMMANDS, type SlashCommand } from './commands.js'
import { resolveModelCommand } from './model.js'
import { NAME, VERSION } from '../index.js'
import { rememberAllowedCommand, loadAgentInstructions } from '../config/loader.js'
import { defaultSystemPrompt } from '../core/message.js'
import { estimateMessagesTokens } from '../utils/token-count.js'

export interface AppProps {
  provider?: Provider
  apiKey: string
  model?: string
  baseUrl?: string
  allowedCommands?: string[]
  allowAllCommands?: boolean
  systemPrompt?: string
  initialPrompt?: string
  resume?: boolean
}

type PermissionAnswer = 'yes' | 'always' | 'no'

interface PermissionReq {
  tool: string
  args: Record<string, unknown>
  resolve: (answer: PermissionAnswer) => void
}

interface ToolEntry {
  name: string
  args: Record<string, unknown>
  done: boolean
  error: boolean
}

type Status = 'idle' | 'thinking' | 'streaming' | 'tool'

let msgId = 0
function nextId(): string {
  return String(++msgId)
}

export function App({ provider = 'deepseek', apiKey, model, baseUrl, allowedCommands = [], allowAllCommands = false, systemPrompt, initialPrompt, resume }: AppProps): React.ReactElement {
  const { exit } = useApp()

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [streamingText, setStreamingText] = useState('')
  const [currentTool, setCurrentTool] = useState<ToolEntry | null>(null)
  const [toolHistory, setToolHistory] = useState<ToolEntry[]>([])
  const [permReq, setPermReq] = useState<PermissionReq | null>(null)
  const [permIdx, setPermIdx] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [matches, setMatches] = useState<SlashCommand[]>([])
  const [matchIdx, setMatchIdx] = useState(0)
  const [multiline, setMultiline] = useState(false)
  const [multilineBuffer, setMultilineBuffer] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [commandOutput, setCommandOutput] = useState('')
  const [modelPicker, setModelPicker] = useState(false)
  const [modelPickerIdx, setModelPickerIdx] = useState(0)

  const agentRef = React.useRef<Agent | null>(null)
  const clientRef = React.useRef<DeepSeekClient | null>(null)
  const registryRef = React.useRef<ToolRegistry | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const bufferRef = React.useRef('')
  const flushRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const sessionRef = React.useRef<SessionData | null>(null)
  const sessionStoreRef = React.useRef(new SessionStore())

  React.useEffect(() => {
    const init = async (): Promise<void> => {
      const clientConfig: { provider: Provider; apiKey: string; model?: string; baseUrl?: string } = { provider, apiKey }
      if (model) clientConfig.model = model
      if (baseUrl) clientConfig.baseUrl = baseUrl
      const client = new DeepSeekClient(clientConfig)

      const cwd = process.cwd()
      const agentInstructions = await loadAgentInstructions(cwd)
      const defaultPrompt = defaultSystemPrompt({ cwd, agentInstructions })

      const registry = new ToolRegistry()
      registry.register(readTool)
      registry.register(writeTool)
      registry.register(editTool)
      registry.register(globTool)
      registry.register(grepTool)
      registry.register(listDirTool)
      registry.register(bashTool)

      const permissionManager = new PermissionManager({
        allowedCommands,
        allowAllCommands,
        rememberBashCommand: rememberAllowedCommand,
        confirm: async (request) => {
          return new Promise((resolve) => {
            setPermIdx(0)
            setPermReq({
              tool: request.toolName,
              args: request.args,
              resolve: (answer) => {
                if (answer === 'yes') resolve('allow_once')
                else if (answer === 'always') resolve('allow_always')
                else resolve('deny')
              },
            })
          })
        },
      })
      registry.setPermissionManager(permissionManager)

      const agent = new Agent(client, registry, {
        systemPrompt: systemPrompt ?? defaultPrompt,
      })

      const store = sessionStoreRef.current
      let session: SessionData
      if (resume) {
        const resumed = await store.resumeLatest()
        if (resumed) {
          session = resumed
          agent.loadMessages(resumed.messages)
        } else {
          session = await store.create()
        }
      } else {
        session = await store.create()
      }

      sessionRef.current = session
      agentRef.current = agent
      clientRef.current = client
      registryRef.current = registry
      setReady(true)

      if (initialPrompt) {
        await runAgent(initialPrompt)
      }
    }
    init().catch(() => {})
  }, [])

  useInput((input, key) => {
    if (permReq) {
      const answers: PermissionAnswer[] = ['yes', 'always', 'no']
      if (key.upArrow) {
        setPermIdx((prev) => (prev - 1 + answers.length) % answers.length)
        return
      }
      if (key.downArrow) {
        setPermIdx((prev) => (prev + 1) % answers.length)
        return
      }
      if (key.return || key.tab) {
        permReq.resolve(answers[permIdx] ?? 'no')
        setPermReq(null)
        setPermIdx(0)
        return
      }
      if (key.escape) {
        permReq.resolve('no')
        setPermReq(null)
        setPermIdx(0)
      }
      return
    }

    if (key.ctrl && input === 'c') {
      if (abortRef.current) {
        abortRef.current.abort()
      } else if (multiline) {
        setMultiline(false)
        setMultilineBuffer([])
      }
      return
    }

    if (key.ctrl && input === 'd') {
      exit()
      return
    }

    // Model picker navigation
    if (modelPicker) {
      if (key.upArrow) {
        setModelPickerIdx((prev) => (prev - 1 + AVAILABLE_MODELS.length) % AVAILABLE_MODELS.length)
        return
      }
      if (key.downArrow) {
        setModelPickerIdx((prev) => (prev + 1) % AVAILABLE_MODELS.length)
        return
      }
      if (key.return || key.tab) {
        const selected = AVAILABLE_MODELS[modelPickerIdx]
        if (selected) {
          try {
            clientRef.current?.setModel(selected)
            setCommandOutput(`Switched to: ${selected}`)
          } catch (err) {
            setCommandOutput(err instanceof Error ? err.message : String(err))
          }
        }
        setModelPicker(false)
        setModelPickerIdx(0)
        return
      }
      if (key.escape) {
        setModelPicker(false)
        setModelPickerIdx(0)
        return
      }
      return
    }

    // Autocomplete navigation
    if (matches.length > 0) {
      if (key.upArrow) {
        setMatchIdx((prev) => (prev - 1 + matches.length) % matches.length)
        return
      }
      if (key.downArrow) {
        setMatchIdx((prev) => (prev + 1) % matches.length)
        return
      }
      if (key.tab || key.return) {
        const selected = matches[matchIdx]
        if (selected) {
          setInputValue(selected.name + ' ')
          setMatches([])
          setMatchIdx(0)
        }
        return
      }
      if (key.escape) {
        setMatches([])
        setMatchIdx(0)
        return
      }
    }
  }, { isActive: true })

  const handleInputChange = (value: string): void => {
    setInputValue(value)
    setCommandOutput('')

    if (value.startsWith('/') && !value.includes(' ')) {
      const m = matchSlashCommands(value)
      setMatches(m)
      setMatchIdx(0)
    } else {
      setMatches([])
      setMatchIdx(0)
    }
  }

  const handleSubmit = async (text: string): Promise<void> => {
    if (matches.length > 0 || modelPicker) return

    setMatches([])
    setMatchIdx(0)
    setInputValue('')

    if (multiline) {
      if (text.trim() === '"""') {
        setMultiline(false)
        const full = multilineBuffer.join('\n')
        setMultilineBuffer([])
        if (full.trim()) await runAgent(full)
      } else {
        setMultilineBuffer((prev) => [...prev, text])
      }
      return
    }

    if (text.trim() === '"""') {
      setMultiline(true)
      return
    }

    if (!text.trim()) return

    if (text.startsWith('/')) {
      handleCommand(text)
      return
    }

    await runAgent(text)
  }

  const runAgent = async (input: string): Promise<void> => {
    const agent = agentRef.current
    if (!agent) return

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: input }])
    setStatus('thinking')
    setStreamingText('')
    setToolHistory([])
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
            setToolHistory((h) => {
              if (bufferRef.current === '' && h.length > 0) {
                for (const t of h) {
                  setMessages((prev) => [...prev, { id: nextId(), role: 'tool', content: `${t.error ? '✗' : '✓'} ${t.name}` }])
                }
                return []
              }
              return h
            })
            setStatus('streaming')
            bufferRef.current += chunk
          },
          onThinking: () => {
            setStatus('thinking')
          },
          onToolCallStart: () => {
            if (bufferRef.current) {
              setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: bufferRef.current }])
              bufferRef.current = ''
              setStreamingText('')
            }
            setStatus('thinking')
          },
          onToolCall: (name, args) => {
            if (bufferRef.current) {
              setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: bufferRef.current }])
              bufferRef.current = ''
              setStreamingText('')
            }
            setStatus('tool')
            let parsed: Record<string, unknown> = {}
            try { parsed = JSON.parse(args) as Record<string, unknown> } catch {}
            const entry: ToolEntry = { name, args: parsed, done: false, error: false }
            setCurrentTool(entry)
          },
          onToolResult: (_name, _result, isError) => {
            setCurrentTool((prev) => {
              if (prev) {
                const completed = { ...prev, done: true, error: isError ?? false }
                setToolHistory((h) => [...h, completed])
              }
              return null
            })
            setStatus('thinking')
          },
          onMaxIterations: () => {
            setMessages((prev) => [...prev, { id: nextId(), role: 'tool', content: 'Reached maximum iterations.' }])
          },
        },
        controller.signal,
      )

      setToolHistory((h) => {
        for (const t of h) {
          setMessages((prev) => [...prev, { id: nextId(), role: 'tool', content: `${t.error ? '✗' : '✓'} ${t.name}` }])
        }
        return []
      })
      if (bufferRef.current) {
        setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: bufferRef.current }])
      }

      const session = sessionRef.current
      if (session) {
        await sessionStoreRef.current.autosave(session, agent.getMessages())
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setMessages((prev) => [...prev, { id: nextId(), role: 'tool', content: `Error: ${err instanceof Error ? err.message : String(err)}` }])
      }
    } finally {
      if (flushRef.current) {
        clearInterval(flushRef.current)
        flushRef.current = null
      }
      abortRef.current = null
      setStatus('idle')
      setStreamingText('')
      setCurrentTool(null)
    }
  }

  const handleCommand = (command: string): void => {
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]

    switch (cmd) {
      case '/help':
        setCommandOutput(
          SLASH_COMMANDS.map((c) => `  ${c.name.padEnd(12)} ${c.description}`).join('\n')
        )
        break
      case '/clear':
        setMessages([])
        setToolHistory([])
        agentRef.current?.resetMessages()
        setCommandOutput('Conversation cleared.')
        break
      case '/exit':
        exit()
        break
      case '/model':
        if (parts[1]) {
          const currentProvider = clientRef.current?.getProvider() ?? provider
          const result = resolveModelCommand(command, currentProvider)
          if (result.model) {
            clientRef.current?.setModel(result.model)
          }
          setCommandOutput(result.message)
        } else {
          const current = clientRef.current?.getModel() ?? 'unknown'
          const currentProvider = clientRef.current?.getProvider() ?? provider
          if (currentProvider === 'deepseek') {
            setCommandOutput(`Current model: ${current}`)
            setModelPickerIdx(Math.max(0, AVAILABLE_MODELS.indexOf(current as typeof AVAILABLE_MODELS[number])))
            setModelPicker(true)
          } else {
            setCommandOutput(`Current model: ${current}\nUse /model <name> to switch models.`)
          }
        }
        break
      case '/status': {
        const msgs = agentRef.current?.getMessages() ?? []
        const tokens = estimateMessagesTokens(msgs)
        const toolCount = registryRef.current?.list().length ?? 0
        setCommandOutput([
          `Provider: ${clientRef.current?.getProvider() ?? provider}`,
          `Base URL: ${clientRef.current?.getBaseUrl() ?? baseUrl ?? 'unknown'}`,
          `Model: ${clientRef.current?.getModel() ?? 'unknown'}`,
          `Working directory: ${process.cwd()}`,
          `Session: ${sessionRef.current?.id ?? 'none'}`,
          `Messages: ${msgs.length}`,
          `Estimated tokens: ${tokens}`,
          `Tools: ${toolCount}`,
        ].join('\n'))
        break
      }
      case '/tools': {
        const tools = registryRef.current?.list() ?? []
        if (tools.length === 0) {
          setCommandOutput('No tools registered.')
        } else {
          setCommandOutput(
            tools.map((t) => `  ${t.name.padEnd(14)} ${t.description.slice(0, 60)}`).join('\n')
          )
        }
        break
      }
      case '/cost': {
        const msgs = agentRef.current?.getMessages() ?? []
        const tokens = estimateMessagesTokens(msgs)
        setCommandOutput(`Session tokens (estimated): ${tokens}`)
        break
      }
      case '/doctor': {
        const checks = [
          `Node:      ${process.version}`,
          `Platform:  ${process.platform} ${process.arch}`,
          `API Key:   ${apiKey ? '✓ set' : '✗ missing'}`,
          `Provider:  ${clientRef.current?.getProvider() ?? provider}`,
          `Base URL:  ${clientRef.current?.getBaseUrl() ?? baseUrl ?? 'unknown'}`,
          `Model:     ${clientRef.current?.getModel() ?? 'unknown'}`,
          `CWD:       ${process.cwd()}`,
          `Session:   ${sessionRef.current?.id ?? 'none'}`,
        ]
        setCommandOutput(checks.join('\n'))
        break
      }
      case '/memory': {
        const sysMsg = agentRef.current?.getMessages().find((m) => m.role === 'system')
        const content = sysMsg?.content ?? 'No system prompt'
        const preview = content.length > 200 ? content.slice(0, 200) + '...' : content
        setCommandOutput(`System prompt:\n${preview}`)
        break
      }
      case '/compact':
        handleCompact()
        break
      case '/resume':
        handleResume()
        break
      case '/version':
        setCommandOutput(`${NAME} v${VERSION}`)
        break
      default:
        setCommandOutput(`Unknown command: ${cmd}`)
    }
  }

  const handleCompact = async (): Promise<void> => {
    const agent = agentRef.current
    if (!agent) return
    setCommandOutput('Compressing context...')
    const compressed = await agent.compressNow()
    if (compressed) {
      const tokens = estimateMessagesTokens(agent.getMessages())
      setCommandOutput(`Context compressed. Tokens now: ${tokens}`)
    } else {
      setCommandOutput('Not enough context to compress.')
    }
  }

  const handleResume = async (): Promise<void> => {
    const session = await sessionStoreRef.current.resumeLatest()
    if (session) {
      agentRef.current?.loadMessages(session.messages)
      sessionRef.current = session
      setMessages([])
      setCommandOutput(`Resumed session: ${session.id} (${session.messages.length} messages)`)
    } else {
      setCommandOutput('No previous session found.')
    }
  }

  if (!ready) {
    return (
      <Box>
        <Text dimColor>Starting {NAME}...</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{NAME} <Text dimColor>v{VERSION}</Text></Text>
      <Text dimColor>Type your message, /help for commands, Ctrl+D to exit</Text>
      <Text> </Text>

      <MessageList messages={messages} />

      {toolHistory.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          {toolHistory.length > 5 && (
            <Text dimColor>  ... {toolHistory.length - 5} more tools above</Text>
          )}
          {toolHistory.slice(-5).map((t, i) => (
            <ToolCallDisplay key={i} name={t.name} args={t.args} done error={t.error} />
          ))}
        </Box>
      )}

      {status === 'thinking' && <StatusIndicator />}
      {status === 'tool' && currentTool && <ToolCallDisplay name={currentTool.name} args={currentTool.args} />}
      {status === 'streaming' && streamingText && <StreamingText text={streamingText} />}

      {permReq && (
        <PermissionPrompt tool={permReq.tool} args={permReq.args} selectedIndex={permIdx} />
      )}

      {commandOutput && (
        <Box marginBottom={1}>
          <Text dimColor>{commandOutput}</Text>
        </Box>
      )}

      {modelPicker && (
        <Box flexDirection="column" marginBottom={0}>
          <Box borderStyle="round" borderColor="gray" flexDirection="column" paddingLeft={1} paddingRight={1}>
            {AVAILABLE_MODELS.map((m, i) => {
              const isSelected = i === modelPickerIdx
              const isCurrent = m === clientRef.current?.getModel()
              return (
                <Box key={m}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '❯' : ' '} </Text>
                  <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>{m}</Text>
                  {isCurrent && <Text color="green"> (current)</Text>}
                </Box>
              )
            })}
          </Box>
          <Text dimColor>  ↑↓ navigate  ⏎ select  Esc cancel</Text>
        </Box>
      )}

      {matches.length > 0 && !modelPicker && (
        <Autocomplete matches={matches} selectedIndex={matchIdx} />
      )}

      <Box>
        <Text color="blue">{multiline ? '... ' : '❯ '}</Text>
        <TextInput
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          focus={status === 'idle' && !permReq && !modelPicker}
        />
      </Box>
    </Box>
  )
}
