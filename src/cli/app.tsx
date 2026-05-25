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
import { getSlashCommands, matchSlashCommands, type SlashCommand } from './commands.js'
import { resolveModelCommand } from './model.js'
import { NAME, VERSION } from '../index.js'
import { rememberAllowedCommand, rememberAllowedTool, loadAgentInstructions } from '../config/loader.js'
import { defaultSystemPrompt } from '../core/message.js'
import { estimateMessagesTokens } from '../utils/token-count.js'
import { loadSkillMetadata } from '../skills/metadata-loader.js'
import { loadSkillActivation } from '../skills/activation-loader.js'
import { SkillRegistry } from '../skills/registry.js'
import { formatActivationSummary, formatSkillActivationPrompt, formatSkillDetail, formatSkillIndex } from '../skills/formatter.js'
import { matchSkill, matchSkillWithModel } from '../skills/matcher.js'
import type { SkillActivationRequest, SkillMetadata } from '../skills/types.js'

export interface AppProps {
  provider?: Provider
  apiKey: string
  model?: string
  baseUrl?: string
  allowedCommands?: string[]
  allowedTools?: string[]
  allowAllCommands?: boolean
  skillsEnabled?: boolean
  skillsAutoMatch?: boolean
  skillsAutoMatchModel?: boolean
  systemPrompt?: string
  initialPrompt?: string
  resume?: boolean
  timeout?: number
}

type PermissionAnswer = 'yes' | 'always' | 'no'
type SkillAnswer = 'yes' | 'no'

interface PermissionReq {
  tool: string
  args: Record<string, unknown>
  resolve: (answer: PermissionAnswer) => void
}

interface SkillReq {
  request: SkillActivationRequest
  resolve: (answer: SkillAnswer) => void
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

export function App({ provider = 'deepseek', apiKey, model, baseUrl, allowedCommands = [], allowedTools = [], allowAllCommands = false, skillsEnabled = true, skillsAutoMatch = true, skillsAutoMatchModel = true, systemPrompt, initialPrompt, resume, timeout }: AppProps): React.ReactElement {
  const { exit } = useApp()

  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [streamingText, setStreamingText] = useState('')
  const [currentTool, setCurrentTool] = useState<ToolEntry | null>(null)
  const [toolHistory, setToolHistory] = useState<ToolEntry[]>([])
  const [permReq, setPermReq] = useState<PermissionReq | null>(null)
  const [permIdx, setPermIdx] = useState(0)
  const [skillReq, setSkillReq] = useState<SkillReq | null>(null)
  const [skillIdx, setSkillIdx] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [matches, setMatches] = useState<SlashCommand[]>([])
  const [matchIdx, setMatchIdx] = useState(0)
  const [multiline, setMultiline] = useState(false)
  const [multilineBuffer, setMultilineBuffer] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [commandOutput, setCommandOutput] = useState('')
  const [modelPicker, setModelPicker] = useState(false)
  const [modelPickerIdx, setModelPickerIdx] = useState(0)
  const [skillPicker, setSkillPicker] = useState<SkillMetadata[]>([])
  const [skillPickerIdx, setSkillPickerIdx] = useState(0)

  const agentRef = React.useRef<Agent | null>(null)
  const clientRef = React.useRef<DeepSeekClient | null>(null)
  const registryRef = React.useRef<ToolRegistry | null>(null)
  const permissionManagerRef = React.useRef<PermissionManager | null>(null)
  const skillRegistryRef = React.useRef<SkillRegistry | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const pendingInputsRef = React.useRef<Array<{ input: string; displayInput: string; addUserMessage: boolean }>>([])
  const runningRef = React.useRef(false)
  const bufferRef = React.useRef('')
  const flushRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const lastFlushedStreamingTextRef = React.useRef('')
  const sessionRef = React.useRef<SessionData | null>(null)
  const sessionStoreRef = React.useRef(new SessionStore())

  React.useEffect(() => {
    const init = async (): Promise<void> => {
      const clientConfig: { provider: Provider; apiKey: string; model?: string; baseUrl?: string; timeout?: number } = { provider, apiKey }
      if (model) clientConfig.model = model
      if (baseUrl) clientConfig.baseUrl = baseUrl
      if (timeout !== undefined) clientConfig.timeout = timeout
      const client = new DeepSeekClient(clientConfig)

      const cwd = process.cwd()
      const agentInstructions = await loadAgentInstructions(cwd)
      const skillMetadata = skillsEnabled ? await loadSkillMetadata({ projectDir: cwd }) : { skills: [], warnings: [] }
      const skillRegistry = new SkillRegistry(skillMetadata.skills, skillMetadata.warnings)
      const defaultPrompt = defaultSystemPrompt({ cwd, agentInstructions }) + formatSkillIndex(skillRegistry.list())

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
        allowedTools,
        allowAllCommands,
        rememberBashCommand: rememberAllowedCommand,
        rememberTool: rememberAllowedTool,
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
      permissionManagerRef.current = permissionManager
      skillRegistryRef.current = skillRegistry
      setReady(true)

      if (initialPrompt) {
        await runAgent(initialPrompt)
      }
    }
    init().catch((err: unknown) => {
      setInitError(formatInitError(err))
      setReady(false)
    })
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

    if (skillReq) {
      const answers: SkillAnswer[] = ['yes', 'no']
      if (key.upArrow || key.downArrow) {
        setSkillIdx((prev) => prev === 0 ? 1 : 0)
        return
      }
      if (key.return || key.tab) {
        skillReq.resolve(answers[skillIdx] ?? 'no')
        setSkillReq(null)
        setSkillIdx(0)
        return
      }
      if (key.escape) {
        skillReq.resolve('no')
        setSkillReq(null)
        setSkillIdx(0)
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

    if (skillPicker.length > 0) {
      if (key.upArrow) {
        setSkillPickerIdx((prev) => (prev - 1 + skillPicker.length) % skillPicker.length)
        return
      }
      if (key.downArrow) {
        setSkillPickerIdx((prev) => (prev + 1) % skillPicker.length)
        return
      }
      if (key.return || key.tab) {
        const selected = skillPicker[skillPickerIdx]
        setSkillPicker([])
        setSkillPickerIdx(0)
        if (selected) {
          setInputValue(`/${selected.name} `)
        }
        return
      }
      if (key.escape) {
        setSkillPicker([])
        setSkillPickerIdx(0)
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
    if (matches.length > 0 || modelPicker || skillPicker.length > 0) return

    setMatches([])
    setMatchIdx(0)
    setInputValue('')

    if (multiline) {
      if (text.trim() === '"""') {
        setMultiline(false)
        const full = multilineBuffer.join('\n')
        setMultilineBuffer([])
        if (full.trim()) enqueueAgentInput(full)
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

    if (skillsEnabled && skillsAutoMatch && !runningRef.current) {
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: text }])
      const client = clientRef.current
      const skills = skillRegistryRef.current?.list() ?? []
      const localSkill = matchSkill(text, skills)
      setStatus('thinking')
      const skill = localSkill ?? (skillsAutoMatchModel && client ? await matchSkillWithModel(text, skills, client) : null)
      if (skill) {
        setStatus('idle')
        void requestSkillActivation(
          { metadata: skill, userArgs: text },
          { onDeny: () => { enqueueAgentInput(text, text, false) } },
        )
        return
      }
      enqueueAgentInput(text, text, false)
      return
    }

    enqueueAgentInput(text)
  }

  const enqueueAgentInput = (input: string, displayInput = input, addUserMessage = true): void => {
    if (addUserMessage) {
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: displayInput }])
    }
    pendingInputsRef.current.push({ input, displayInput, addUserMessage: false })
    if (!runningRef.current) {
      void runNextAgentInput()
    }
  }

  const runNextAgentInput = async (): Promise<void> => {
    if (runningRef.current) return
    const next = pendingInputsRef.current.shift()
    if (!next) return

    runningRef.current = true
    try {
      await runAgent(next.input, [], next.displayInput, next.addUserMessage)
    } finally {
      runningRef.current = false
      void runNextAgentInput()
    }
  }

  const runAgent = async (input: string, allowedTools: SkillActivationRequest['metadata']['allowedTools'] = [], displayInput = input, addUserMessage = true): Promise<void> => {
    const agent = agentRef.current
    const permissionManager = permissionManagerRef.current
    if (!agent) return

    if (addUserMessage) {
      setMessages((prev) => [...prev, { id: nextId(), role: 'user', content: displayInput }])
    }
    setStatus('thinking')
    setStreamingText('')
    lastFlushedStreamingTextRef.current = ''
    setToolHistory([])
    bufferRef.current = ''

    const controller = new AbortController()
    abortRef.current = controller

    flushRef.current = setInterval(() => {
      if (bufferRef.current && bufferRef.current !== lastFlushedStreamingTextRef.current) {
        lastFlushedStreamingTextRef.current = bufferRef.current
        setStreamingText(bufferRef.current)
      }
    }, 50)

    try {
      const execute = async (): Promise<void> => {
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
                lastFlushedStreamingTextRef.current = ''
                setStreamingText('')
              }
              setStatus('thinking')
            },
            onToolCall: (name, args) => {
              if (bufferRef.current) {
                setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: bufferRef.current }])
                bufferRef.current = ''
                lastFlushedStreamingTextRef.current = ''
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
      }
      if (allowedTools.length > 0 && permissionManager) {
        await permissionManager.withTemporaryAllowlist(allowedTools, execute)
      } else {
        await execute()
      }

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
      lastFlushedStreamingTextRef.current = ''
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
          getSlashCommands().map((c) => `  ${c.name.padEnd(12)} ${c.description}`).join('\n')
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
      case '/skills': {
        const skillRegistry = skillRegistryRef.current
        if (!skillRegistry) {
          setCommandOutput('Skills are disabled.')
        } else if (parts[1]) {
          const skill = skillRegistry.get(parts[1])
          setCommandOutput(skill ? formatSkillDetail(skill) : `Unknown skill: ${parts[1]}`)
        } else {
          const skills = skillRegistry.list()
          if (skills.length === 0) {
            setCommandOutput('No skills found.')
          } else {
            setCommandOutput('')
            setSkillPicker(skills)
            setSkillPickerIdx(0)
          }
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
        const skillRegistry = skillRegistryRef.current
        const checks = [
          `Node:      ${process.version}`,
          `Platform:  ${process.platform} ${process.arch}`,
          `API Key:   ${apiKey ? '✓ set' : '✗ missing'}`,
          `Provider:  ${clientRef.current?.getProvider() ?? provider}`,
          `Base URL:  ${clientRef.current?.getBaseUrl() ?? baseUrl ?? 'unknown'}`,
          `Model:     ${clientRef.current?.getModel() ?? 'unknown'}`,
          `CWD:       ${process.cwd()}`,
          `Session:   ${sessionRef.current?.id ?? 'none'}`,
          `Skills:    ${skillsEnabled ? `${skillRegistry?.list().length ?? 0} loaded, autoMatch=${skillsAutoMatch}, autoMatchModel=${skillsAutoMatchModel}, warnings=${skillRegistry?.getWarnings().length ?? 0}` : 'disabled'}`,
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
      default: {
        const skillName = cmd?.slice(1) ?? ''
        const skill = skillRegistryRef.current?.get(skillName)
        if (skill) {
          void requestSkillActivation({ metadata: skill, userArgs: parts.slice(1).join(' ') })
        } else {
          setCommandOutput(`Unknown command: ${cmd}`)
        }
      }
    }
  }

  const requestSkillActivation = async (request: SkillActivationRequest, options: { onDeny?: () => void } = {}): Promise<void> => {
    const answer = await new Promise<SkillAnswer>((resolve) => {
      setSkillIdx(0)
      setSkillReq({ request, resolve })
    })
    if (answer === 'no') {
      if (options.onDeny) {
        options.onDeny()
      } else {
        setCommandOutput(`Skill not activated: ${request.metadata.name}`)
      }
      return
    }

    try {
      const skill = await loadSkillActivation(request.metadata)
      const prompt = formatSkillActivationPrompt(skill, request.userArgs)
      const displayInput = request.userArgs ? `/${skill.metadata.name} ${request.userArgs}` : `/${skill.metadata.name}`
      await runAgent(prompt, skill.metadata.allowedTools, displayInput, false)
    } catch (err) {
      setCommandOutput(`Failed to activate skill: ${err instanceof Error ? err.message : String(err)}`)
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
    if (initError) {
      return (
        <Box flexDirection="column">
          <Text bold color="red">Failed to start {NAME}</Text>
          <Text color="red">{initError}</Text>
          <Text dimColor>Run /doctor after fixing the issue, or check your API key, config files, and skill metadata.</Text>
        </Box>
      )
    }

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

      {skillReq && (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text color="yellow" bold>Skill activation</Text>
          <Text>{formatActivationSummary(skillReq.request.metadata)}</Text>
          <Text> </Text>
          {['Yes', 'No'].map((label, index) => {
            const selected = index === skillIdx
            return (
              <Text key={label}>
                <Text color={selected ? 'cyan' : 'gray'}>{selected ? '❯' : ' '} </Text>
                <Text color={selected ? (index === 0 ? 'green' : 'red') : 'white'} bold={selected}>{label}</Text>
              </Text>
            )
          })}
          <Text dimColor>  ↑↓ navigate  ⏎ select  Esc deny</Text>
        </Box>
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

      {skillPicker.length > 0 && (
        <Box flexDirection="column" marginBottom={0}>
          <Box borderStyle="round" borderColor="gray" flexDirection="column" paddingLeft={1} paddingRight={1}>
            {skillPicker.map((skill, i) => {
              const isSelected = i === skillPickerIdx
              return (
                <Box key={skill.name}>
                  <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '❯' : ' '} </Text>
                  <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>{`/${skill.name}`.padEnd(14)}</Text>
                  <Text color="gray"> {skill.description}</Text>
                </Box>
              )
            })}
          </Box>
          <Text dimColor>  ↑↓ navigate  ⏎/Tab select  Esc dismiss</Text>
        </Box>
      )}

      {matches.length > 0 && !modelPicker && skillPicker.length === 0 && (
        <Autocomplete matches={matches} selectedIndex={matchIdx} />
      )}

      <Box>
        <Text color="blue">{multiline ? '... ' : '❯ '}</Text>
        <TextInput
          value={inputValue}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          focus={!permReq && !skillReq && !modelPicker && skillPicker.length === 0}
        />
      </Box>
    </Box>
  )
}

export function formatInitError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
