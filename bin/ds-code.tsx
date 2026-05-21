#!/usr/bin/env node

import React from 'react'
import { render } from 'ink'
import { NAME, VERSION } from '../src/index.js'
import { App } from '../src/cli/app.js'
import { loadConfig } from '../src/config/loader.js'
import { resolveCliOptions } from '../src/cli/options.js'

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

const config = await loadConfig()
const options = resolveCliOptions(args, config, process.env)

if (!options.apiKey) {
  console.error('Missing API key. Set DEEPSEEK_API_KEY or apiKey in ~/.ds-code/config.json or project .ds-code/settings.json.')
  process.exit(1)
}

render(
  React.createElement(App, {
    apiKey: options.apiKey,
    ...(options.model ? { model: options.model } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.initialPrompt ? { initialPrompt: options.initialPrompt } : {}),
    resume: options.resume,
  }),
  { exitOnCtrlC: false }
)
