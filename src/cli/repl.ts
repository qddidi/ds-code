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
import { renderMarkdown, renderToolCall, renderToolResult, toolCallSpinnerText, isReadTool, ReadFileTracker, renderWelcome, renderError, renderThinking, renderAfterTool } from './output.js'
import { parseInput } from './input.js'
import { modelCommand } from './model.js'
import { NAME, VERSION } from '../index.js'
import { SLASH_COMMANDS } from './commands.js'
import { openSlashDropdown } from './slash-dropdown.js'

export interface ReplOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  systemPrompt?: string
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

You have tools to read, write, edit, list, search files, and execute shell commands. When the user asks about the current project, use list_dir, glob, grep, or read_file to examine files like package.json, README.md, or source files to understand the project before answering. Always base your answers on actual file contents, not assumptions.`

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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.blue('> '),
  })

  console.log(renderWelcome('0.1.0'))
  rl.prompt()

  let abortController: AbortController | null = null
  let slashDropdownOpen = false

  readline.emitKeypressEvents(process.stdin, rl)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
  }

  process.stdin.on('keypress', async (str) => {
    if (slashDropdownOpen || str !== '/' || (rl.line !== '' && rl.line !== '/')) return
    slashDropdownOpen = true
    rl.pause()
    const selection = await openSlashDropdown('/')
    rl.resume()
    slashDropdownOpen = false
    if (selection.command) {
      handleCommand(selection.command, rl, registry, client)
    }
    rl.prompt()
  })

  rl.on('line', async (line) => {
    const input = parseInput(line)

    if (input.type === 'empty') {
      rl.prompt()
      return
    }

    if (input.type === 'command' && input.content === '/') {
      if (!slashDropdownOpen) {
        const selection = await openSlashDropdown('/')
        if (selection.command) {
          handleCommand(selection.command, rl, registry, client)
        }
      }
      rl.prompt()
      return
    }

    if (input.type === 'command') {
      handleCommand(input.content, rl, registry, client)
      rl.prompt()
      return
    }

    abortController = new AbortController()
    spinner.start(renderThinking())

    const readTracker = new ReadFileTracker()
    let currentToolArgs = ''

    try {
      const result = await agent.run(input.content, {
        onContent: (text) => {
          spinner.stop()
          readTracker.reset()
          console.log('\n' + renderMarkdown(text))
        },
        onToolCall: (name, args) => {
          spinner.stop()
          currentToolArgs = args

          if (isReadTool(name)) {
            spinner.start(toolCallSpinnerText(name, args))
          } else {
            readTracker.reset()
            console.log(renderToolCall(name, args))
            spinner.start(toolCallSpinnerText(name, args))
          }
        },
        onToolResult: (name, _result, isError) => {
          spinner.stop()
          const nextStep = renderAfterTool(name, isError)

          if (isReadTool(name)) {
            if (!isError) {
              const parsed = safeParseArgs(currentToolArgs)
              readTracker.add(parsed?.file_path ?? name)
              console.log(readTracker.render())
            }
            spinner.start(nextStep)
          } else {
            console.log(renderToolResult(name, isError))
            spinner.start(nextStep)
          }
        },
      })

      spinner.stop()
      readTracker.reset()
      if (!result) {
        console.log(chalk.dim('(no response)'))
      }
    } catch (err) {
      spinner.stop()
      readTracker.reset()
      console.log(renderError(err instanceof Error ? err.message : String(err)))
    } finally {
      abortController = null
      console.log('')
      rl.prompt()
    }
  })

  rl.on('close', () => {
    spinner.stop()
    console.log(chalk.dim('\nGoodbye!'))
    process.exit(0)
  })

  process.on('SIGINT', () => {
    if (abortController) {
      abortController.abort()
      spinner.stop()
      console.log(chalk.yellow('\n(interrupted)'))
      rl.prompt()
    } else {
      rl.close()
    }
  })
}

function safeParseArgs(args: string): Record<string, string> | null {
  try {
    return JSON.parse(args)
  } catch {
    return null
  }
}

function handleCommand(command: string, rl: readline.Interface, registry: ToolRegistry, client: DeepSeekClient): void {
  const cmd = command.split(' ')[0]

  switch (cmd) {
    case '/help':
      console.log([
        '',
        chalk.bold('Commands:'),
        ...SLASH_COMMANDS.map((command) => `  ${command.name.padEnd(8)} ${command.description}`),
        '',
      ].join('\n'))
      break
    case '/exit':
      rl.close()
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
      break
    case '/tools':
      console.log([
        '',
        chalk.bold('Tools:'),
        ...registry.list().map((tool) => `  ${tool.name.padEnd(12)} ${tool.description}`),
        '',
      ].join('\n'))
      break
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
