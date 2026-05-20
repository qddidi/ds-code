#!/usr/bin/env node

import React from 'react'
import { render } from 'ink'
import { NAME, VERSION } from '../src/index.js'
import { App } from '../src/cli/app.js'

const args = process.argv.slice(2)

if (args.includes('--version') || args.includes('-v')) {
  console.log(`${NAME} v${VERSION}`)
  process.exit(0)
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`${NAME} v${VERSION}

AI-powered coding assistant CLI using DeepSeek API

Usage:
  ds-code [options] [prompt]

Options:
  -v, --version    Show version
  -h, --help       Show help
  --model <model>  Model to use (deepseek-v4-pro, deepseek-v4-flash, deepseek-reasoner)
  --resume         Resume last session

Examples:
  ds-code                     Start interactive session
  ds-code "fix the bug"       Start with initial prompt
  ds-code --model reasoner    Use DeepSeek reasoner model
  ds-code --resume            Resume previous conversation`)
  process.exit(0)
}

const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) {
  console.error('Missing DEEPSEEK_API_KEY environment variable.')
  process.exit(1)
}

const model = readOption('--model')
const resume = args.includes('--resume')

const positionalArgs = args.filter((arg, i) => {
  if (arg.startsWith('--')) return false
  if (i > 0 && args[i - 1] === '--model') return false
  return true
})
const initialPrompt = positionalArgs.length > 0 ? positionalArgs.join(' ') : undefined

render(
  React.createElement(App, {
    apiKey,
    ...(model ? { model } : {}),
    ...(initialPrompt ? { initialPrompt } : {}),
    resume,
  }),
  { exitOnCtrlC: false }
)

function readOption(name: string): string | undefined {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
