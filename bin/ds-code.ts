#!/usr/bin/env node

import { VERSION, NAME } from '../src/index.js'

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
  --model <model>  Model to use (deepseek-chat, deepseek-reasoner)

Examples:
  ds-code                     Start interactive session
  ds-code "fix the bug"       Start with initial prompt
  ds-code --model reasoner    Use DeepSeek R1 model`)
  process.exit(0)
}

console.log(`${NAME} v${VERSION} — starting...`)
