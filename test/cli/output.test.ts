import { describe, it, expect } from 'vitest'
import {
  renderMarkdown,
  renderWelcome,
  renderError,
  renderThinking,
  renderAfterTool,
  toolCallSpinnerText,
  renderToolCall,
  renderToolResult,
} from '../../src/cli/output.js'

describe('renderMarkdown', () => {
  it('renders code block with syntax highlighting', () => {
    const input = '```js\nconst x = 1;\n```'
    const output = renderMarkdown(input)
    // Should contain the code content (may have ANSI codes for highlighting)
    expect(output).toContain('const')
    expect(output).toContain('x')
    expect(output).toContain('1')
  })

  it('renders heading as bold/styled', () => {
    const input = '# Hello World'
    const output = renderMarkdown(input)
    expect(output).toContain('Hello World')
  })

  it('renders unordered list with indentation', () => {
    const input = '- item one\n- item two\n- item three'
    const output = renderMarkdown(input)
    expect(output).toContain('item one')
    expect(output).toContain('item two')
    expect(output).toContain('item three')
  })

  it('renders ordered list', () => {
    const input = '1. first\n2. second'
    const output = renderMarkdown(input)
    expect(output).toContain('first')
    expect(output).toContain('second')
  })

  it('renders plain text unchanged', () => {
    const input = 'Hello world'
    const output = renderMarkdown(input)
    expect(output).toContain('Hello world')
  })
})

describe('renderWelcome', () => {
  it('includes version', () => {
    const output = renderWelcome('0.1.0')
    expect(output).toContain('0.1.0')
    expect(output).toContain('ds-code')
  })
})

describe('renderError', () => {
  it('includes error message', () => {
    const output = renderError('something broke')
    expect(output).toContain('something broke')
    expect(output).toContain('Error')
  })
})
describe('human-friendly progress messages', () => {
  it('renders thinking status', () => {
    expect(renderThinking()).toContain('正在分析')
  })

  it('renders tool completion status', () => {
    expect(renderAfterTool('list_dir', false)).toContain('查看目录 已完成')
    expect(renderAfterTool('grep', true)).toContain('搜索内容 遇到问题')
  })

  it('renders localized spinner text for tools', () => {
    expect(toolCallSpinnerText('list_dir', '{"path":"D:/ds"}')).toContain('正在查看')
    expect(toolCallSpinnerText('grep', '{"pattern":"Agent"}')).toContain('正在搜索')
  })

  it('renders list_dir tool call summary', () => {
    const output = renderToolCall('list_dir', '{"path":"D:/ds"}')
    expect(output).toContain('List')
    expect(output).toContain('D:/ds')
  })

  it('renders write_file byte result summary', () => {
    const output = renderToolResult('write_file', false, 'File written: D:/ds/a.txt (12 bytes)')
    expect(output).toContain('write_file')
    expect(output).toContain('12 bytes')
  })
})
