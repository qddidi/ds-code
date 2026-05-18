import * as readline from 'node:readline'
import chalk from 'chalk'
import { Agent } from '../core/agent.js'
import { DeepSeekClient } from '../api/deepseek.js'
import { ToolRegistry } from '../tools/registry.js'
import { Spinner } from './spinner.js'
import { renderMarkdown, renderToolCall, renderToolResult, renderWelcome, renderError } from './output.js'
import { parseInput } from './input.js'

export interface ReplOptions {
  apiKey: string
  model?: string
  baseUrl?: string
  systemPrompt?: string
}

export async function startRepl(options: ReplOptions): Promise<void> {
  const client = new DeepSeekClient({
    apiKey: options.apiKey,
    model: options.model ?? 'deepseek-chat',
    baseUrl: options.baseUrl,
  })

  const registry = new ToolRegistry()
  const agent = new Agent(client, registry, {
    systemPrompt: options.systemPrompt ?? 'You are a helpful coding assistant.',
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

  rl.on('line', async (line) => {
    const input = parseInput(line)

    if (input.type === 'empty') {
      rl.prompt()
      return
    }

    if (input.type === 'command') {
      handleCommand(input.content, rl)
      rl.prompt()
      return
    }

    abortController = new AbortController()
    spinner.start()

    try {
      const result = await agent.run(input.content, {
        onContent: (text) => {
          spinner.stop()
          console.log('\n' + renderMarkdown(text))
        },
        onToolCall: (name, args) => {
          spinner.stop()
          console.log(renderToolCall(name, args))
          spinner.start('Running tool...')
        },
        onToolResult: (name, _result, isError) => {
          spinner.stop()
          console.log(renderToolResult(name, isError))
          spinner.start()
        },
      })

      spinner.stop()
      if (!result) {
        console.log(chalk.dim('(no response)'))
      }
    } catch (err) {
      spinner.stop()
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

function handleCommand(command: string, rl: readline.Interface): void {
  const cmd = command.split(' ')[0]

  switch (cmd) {
    case '/help':
      console.log([
        '',
        chalk.bold('Commands:'),
        '  /help     Show this help',
        '  /clear    Clear conversation history',
        '  /exit     Exit the program',
        '',
      ].join('\n'))
      break
    case '/exit':
      rl.close()
      break
    case '/clear':
      console.log(chalk.dim('Conversation cleared.'))
      break
    default:
      console.log(chalk.yellow(`Unknown command: ${cmd}`))
  }
}
