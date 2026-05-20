import * as readline from 'node:readline'
import chalk from 'chalk'
import { Agent } from '../core/agent.js'
import { DeepSeekClient } from '../api/deepseek.js'
import { ToolRegistry } from '../tools/registry.js'
import { readTool } from '../tools/read.js'
import { writeTool } from '../tools/write.js'
import { editTool } from '../tools/edit.js'
import { globTool } from '../tools/glob.js'
import { grepTool } from '../tools/grep.js'
import { listDirTool } from '../tools/list-dir.js'
import { bashTool } from '../tools/bash.js'
import { Spinner } from './spinner.js'
import { renderToolCall, renderToolResult, toolCallSpinnerText, renderWelcome, renderError, renderThinking, renderAfterTool } from './output.js'
import { parseInput } from './input.js'
import { modelCommand } from './model.js'
import { NAME, VERSION } from '../index.js'
import { SLASH_COMMANDS } from './commands.js'
import { SlashAutocomplete } from './slash-autocomplete.js'
import { PermissionManager } from '../permissions/manager.js'
import { createPermissionConfirm } from './permission-prompt.js'
import { SessionStore, type SessionData } from '../core/session.js'

export interface ReplOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  systemPrompt?: string
  initialPrompt?: string
  resume?: boolean
}

export async function startRepl(options: ReplOptions): Promise<void> {
  const clientConfig: { apiKey: string; model?: string; baseUrl?: string } = {
    apiKey: options.apiKey,
  }
  if (options.model) clientConfig.model = options.model
  if (options.baseUrl) clientConfig.baseUrl = options.baseUrl
  const client = new DeepSeekClient(clientConfig)

  const cwd = process.cwd()
  const defaultSystemPrompt = `You are ds-code, an AI coding assistant running in the user's terminal.

Working directory: ${cwd}

You have tools to read, write, edit, list, search files, and execute shell commands. Use tools only when the user asks about code, files, or the project. For general conversation, respond directly without using tools.`

  const registry = new ToolRegistry()
  registry.register(readTool)
  registry.register(writeTool)
  registry.register(editTool)
  registry.register(globTool)
  registry.register(grepTool)
  registry.register(listDirTool)
  registry.register(bashTool)

  const agent = new Agent(client, registry, {
    systemPrompt: options.systemPrompt ?? defaultSystemPrompt,
  })

  const spinner = new Spinner()
  const sessionStore = new SessionStore()
  let session: SessionData

  if (options.resume) {
    const resumed = await sessionStore.resumeLatest()
    if (resumed) {
      session = resumed
      agent.loadMessages(resumed.messages)
      console.log(chalk.dim(`Resumed session ${resumed.id} (${resumed.messages.length} messages)`))
    } else {
      session = await sessionStore.create()
      console.log(chalk.dim('No previous session found, starting new.'))
    }
  } else {
    session = await sessionStore.create()
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue('> '),
  })

  const permissionManager = new PermissionManager({
    confirm: createPermissionConfirm(rl),
  })

  registry.setPermissionManager(permissionManager)

  console.log(renderWelcome(VERSION))
  rl.prompt()

  let abortController: AbortController | null = null
  let isProcessing = false
  let multilineBuffer: string[] | null = null
  const autocomplete = new SlashAutocomplete()

  readline.emitKeypressEvents(process.stdin, rl)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  process.stdin.on('keypress', (_str, key) => {
    if (isProcessing) return

    if (key && key.name === 'up' && autocomplete.isActive()) {
      autocomplete.moveUp()
      return
    }
    if (key && key.name === 'down' && autocomplete.isActive()) {
      autocomplete.moveDown()
      return
    }
    if (key && key.name === 'tab' && autocomplete.isActive()) {
      const selected = autocomplete.getSelected()
      if (selected) {
        autocomplete.hide()
        rl.write(null, { ctrl: true, name: 'u' })
        rl.write(selected)
      }
      return
    }

    // Update autocomplete on next tick (after readline processes the key)
    setImmediate(() => {
      autocomplete.update(rl.line)
    })
  })

  rl.on('line', (line) => {
    const selected = autocomplete.getSelected()
    autocomplete.hide()
    if (selected && line.startsWith('/') && !line.includes(' ')) {
      handleLine(selected)
    } else {
      handleLine(line)
    }
  })
  rl.on('close', () => process.exit(0))

  rl.on('SIGINT', () => {
    if (isProcessing && abortController) {
      abortController.abort()
      spinner.stop()
      console.log(chalk.dim('\n已中断'))
      isProcessing = false
      rl.prompt()
    } else if (multilineBuffer) {
      multilineBuffer = null
      console.log(chalk.dim('\n已取消多行输入'))
      rl.setPrompt(chalk.blue('> '))
      rl.prompt()
    } else {
      console.log(chalk.dim('\n(Ctrl+D to exit)'))
      rl.prompt()
    }
  })

  if (options.initialPrompt) {
    handleLine(options.initialPrompt)
  }

  async function handleLine(raw: string): Promise<void> {
    if (multilineBuffer !== null) {
      if (raw.trim() === '"""') {
        const message = multilineBuffer.join('\n')
        multilineBuffer = null
        rl.setPrompt(chalk.blue('> '))
        if (message.trim()) {
          await processMessage(message)
        } else {
          rl.prompt()
        }
      } else {
        multilineBuffer.push(raw)
        rl.prompt()
      }
      return
    }

    const input = parseInput(raw)

    switch (input.type) {
      case 'empty':
        rl.prompt()
        return
      case 'exit':
        rl.close()
        return
      case 'command':
        await handleCommand(input.content)
        rl.prompt()
        return
      case 'message':
        if (input.content === '"""') {
          multilineBuffer = []
          rl.setPrompt(chalk.dim('... '))
          rl.prompt()
          return
        }
        await processMessage(input.content)
        return
    }
  }

  async function processMessage(input: string): Promise<void> {
    isProcessing = true
    abortController = new AbortController()
    let hasOutput = false

    spinner.start(renderThinking())

    try {
      await agent.run(
        input,
        {
          onContent: (chunk) => {
            if (!hasOutput) {
              spinner.stop()
              hasOutput = true
            }
            process.stdout.write(chunk)
          },
          onThinking: () => {
            spinner.setText(chalk.dim('Thinking...'))
          },
          onToolCall: (name, args) => {
            if (hasOutput) {
              process.stdout.write('\n')
              hasOutput = false
            }
            spinner.stop()
            console.log(renderToolCall(name, args))
            spinner.start(toolCallSpinnerText(name, args))
          },
          onToolResult: (name, result, isError) => {
            spinner.stop()
            console.log(renderToolResult(name, isError, result))
            spinner.start(renderAfterTool(name, isError))
          },
          onMaxIterations: () => {
            spinner.stop()
            console.log(chalk.yellow('Reached maximum iterations.'))
          },
        },
        abortController.signal,
      )

      if (hasOutput) {
        process.stdout.write('\n')
      }

      spinner.stop()
      await sessionStore.autosave(session, agent.getMessages())
    } catch (err) {
      spinner.stop()
      if (hasOutput) process.stdout.write('\n')
      if (abortController.signal.aborted) {
        // Already handled by SIGINT handler
      } else {
        console.log(renderError(err instanceof Error ? err.message : String(err)))
      }
    } finally {
      isProcessing = false
      abortController = null
      rl.prompt()
    }
  }

  async function handleCommand(command: string): Promise<void> {
    const parts = command.trim().split(/\s+/)
    const cmd = parts[0]

    switch (cmd) {
      case '/help':
        if (parts[1]) {
          const target = SLASH_COMMANDS.find((c) => c.name === `/${parts[1]}`)
          if (target) {
            console.log(`  ${chalk.bold(target.name)} — ${target.description}`)
            if (target.aliases?.length) {
              console.log(chalk.dim(`  Aliases: ${target.aliases.join(', ')}`))
            }
          } else {
            console.log(chalk.yellow(`Unknown command: /${parts[1]}`))
          }
        } else {
          console.log([
            '',
            chalk.bold('Commands:'),
            ...SLASH_COMMANDS.map((c) => `  ${c.name.padEnd(12)} ${c.description}`),
            '',
            chalk.bold('Shortcuts:'),
            '  Ctrl+C       Interrupt current operation',
            '  Ctrl+D       Exit',
            '  """          Start/end multi-line input',
            '',
            chalk.bold('Config:'),
            `  ~/.ds-code/config.json    Global config`,
            `  .ds-code.json             Project config`,
            '',
            chalk.bold('Examples:'),
            '  ds-code "fix the bug"     Start with prompt',
            '  ds-code --resume          Resume last session',
            '  ds-code --model flash     Use flash model',
            '',
          ].join('\n'))
        }
        break
      case '/clear':
        console.log(chalk.dim('Conversation cleared.'))
        break
      case '/model':
        console.log(chalk.dim(modelCommand(command)))
        break
      case '/status':
        console.log(chalk.dim(`Working directory: ${process.cwd()}`))
        console.log(chalk.dim(`Model: ${client.getModel()}`))
        console.log(chalk.dim(`Session: ${session.id}`))
        break
      case '/tools':
        console.log([
          '',
          chalk.bold('Tools:'),
          ...registry.list().map((tool) => `  ${tool.name.padEnd(12)} ${tool.description}`),
          '',
        ].join('\n'))
        break
      case '/resume': {
        const resumed = await sessionStore.resumeLatest()
        if (resumed) {
          Object.assign(session, resumed)
          agent.loadMessages(resumed.messages)
          console.log(chalk.dim(`Resumed session ${resumed.id} (${resumed.messages.length} messages)`))
        } else {
          console.log(chalk.dim('No previous session found.'))
        }
        break
      }
      case '/memory':
        console.log(chalk.dim('Memory is not implemented in ds-code yet.'))
        break
      case '/compact':
        console.log(chalk.dim('Context compaction is not wired into the REPL yet.'))
        break
      case '/cost':
        console.log(chalk.dim('Cost tracking is not implemented yet.'))
        break
      case '/doctor':
        console.log(chalk.dim(`Node.js ${process.version}`))
        console.log(chalk.dim(`API key: ${process.env.DEEPSEEK_API_KEY ? 'set' : 'missing'}`))
        break
      case '/version':
        console.log(`${NAME} v${VERSION}`)
        break
      default:
        console.log(chalk.yellow(`Unknown command: ${cmd}`))
    }
  }
}
