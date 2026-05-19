import { startRepl } from './src/cli/repl.js'

const apiKey = process.env['DEEPSEEK_API_KEY']
if (!apiKey) {
  console.error('请设置环境变量 DEEPSEEK_API_KEY')
  console.error('  export DEEPSEEK_API_KEY=sk-xxx')
  process.exit(1)
}

startRepl({ apiKey })
