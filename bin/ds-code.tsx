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

AI-powered coding assistant CLI using DeepSeek, OpenAI, or OpenAI-compatible APIs

Usage:
  ds-code [options] [prompt]

Options:
  -v, --version    Show version
  -h, --help       Show help
  --model <model>       Model to use, e.g. deepseek-v4-pro or gpt-4o
  --provider <provider> deepseek, openai, or custom
  --base-url <url>      OpenAI-compatible API base URL
  --resume              Resume last session

Examples:
  ds-code                     Start interactive session
  ds-code "fix the bug"       Start with initial prompt
  ds-code --model reasoner                         Use DeepSeek reasoner model
  ds-code --provider openai --model gpt-4o         Use OpenAI
  ds-code --provider custom --base-url <url>       Use an OpenAI-compatible relay
  ds-code --resume                                 Resume previous conversation`)
  process.exit(0)
}

const config = await loadConfig()
const options = resolveCliOptions(args, config, process.env)

if (!options.apiKey) {
  console.error('Missing API key. Set OPENAI_API_KEY, DEEPSEEK_API_KEY, or apiKey in ~/.ds-code/config.json or project .ds-code/settings.json.')
  process.exit(1)
}

render(
  React.createElement(App, {
    provider: options.provider,
    apiKey: options.apiKey,
    ...(options.model ? { model: options.model } : {}),
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    allowedCommands: options.allowedCommands,
    allowedTools: options.allowedTools,
    allowAllCommands: options.allowAllCommands,
    skillsEnabled: options.skillsEnabled,
    skillsAutoMatch: options.skillsAutoMatch,
    skillsAutoMatchModel: options.skillsAutoMatchModel,
    ...(options.initialPrompt ? { initialPrompt: options.initialPrompt } : {}),
    resume: options.resume,
  }),
  { exitOnCtrlC: false }
)
