import React from 'react'
import { Box, Text, Static } from 'ink'
import { renderMarkdown } from '../output.js'

interface DisplayMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
}

interface MessageListProps {
  messages: DisplayMessage[]
}

export function MessageList({ messages }: MessageListProps): React.ReactElement | null {
  if (messages.length === 0) return null

  return (
    <Static items={messages}>
      {(msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={0}>
          {msg.role === 'user' && (
            <Box>
              <Text bold color="green">{`❯ `}</Text>
              <Text>{msg.content}</Text>
            </Box>
          )}
          {msg.role === 'assistant' && (
            <Text>{renderMarkdown(msg.content)}</Text>
          )}
          {msg.role === 'tool' && <ToolMessage content={msg.content} />}
        </Box>
      )}
    </Static>
  )
}

function ToolMessage({ content }: { content: string }): React.ReactElement {
  const diffStart = findUnifiedDiffStart(content)
  if (diffStart === -1) {
    return <Text dimColor>{content}</Text>
  }

  const summary = content.slice(0, diffStart).trimEnd()
  const diff = content.slice(diffStart)

  return (
    <Box flexDirection="column">
      {summary && <Text dimColor>{summary}</Text>}
      <DiffText diff={diff} />
    </Box>
  )
}

function DiffText({ diff }: { diff: string }): React.ReactElement {
  return (
    <Box flexDirection="column">
      {formatDiffRows(diff).map((row, index) => (
        <DiffRow key={index} row={row} />
      ))}
    </Box>
  )
}

type DiffRow =
  | { type: 'file'; text: string }
  | { type: 'hunk'; oldLine: number; newLine: number }
  | { type: 'add' | 'remove' | 'context'; oldLine?: number; newLine?: number; text: string }
  | { type: 'blank' }

function DiffRow({ row }: { row: DiffRow }): React.ReactElement | null {
  if (row.type === 'blank') return <Text> </Text>
  if (row.type === 'file') return <Text bold>{row.text}</Text>
  if (row.type === 'hunk') {
    return <Text color="cyan">{`${String(row.newLine).padStart(7)} `}</Text>
  }

  const lineNumber = row.type === 'remove' ? row.oldLine : row.newLine
  const marker = row.type === 'add' ? '+' : row.type === 'remove' ? '-' : ' '
  const color = row.type === 'add' ? 'green' : row.type === 'remove' ? 'red' : undefined
  const prefix = `${lineNumber === undefined ? ' '.repeat(7) : String(lineNumber).padStart(7)} ${marker} `

  return color
    ? <Text color={color}>{prefix}{row.text}</Text>
    : <Text dimColor>{prefix}{row.text}</Text>
}

function formatDiffRows(diff: string): DiffRow[] {
  const rows: DiffRow[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      const file = formatDiffFileLine(line)
      if (file) rows.push({ type: 'file', text: `Update(${file})` })
      continue
    }
    if (line.startsWith('--- ') || line.startsWith('+++ ')) continue
    if (line.startsWith('@@')) {
      const hunk = parseHunkHeader(line)
      if (hunk) {
        oldLine = hunk.oldStart
        newLine = hunk.newStart
        rows.push({ type: 'hunk', oldLine, newLine })
      }
      continue
    }
    if (line.startsWith('+')) {
      rows.push({ type: 'add', newLine, text: line.slice(1) })
      newLine++
      continue
    }
    if (line.startsWith('-')) {
      rows.push({ type: 'remove', oldLine, text: line.slice(1) })
      oldLine++
      continue
    }
    if (line.startsWith(' ')) {
      rows.push({ type: 'context', oldLine, newLine, text: line.slice(1) })
      oldLine++
      newLine++
      continue
    }
    if (!line) rows.push({ type: 'blank' })
  }

  return rows
}

function formatDiffFileLine(line: string): string | null {
  const match = /^diff --git\s+a\/(.*?)\s+b\/(.*)$/.exec(line)
  if (!match) return null
  return match[2] ?? match[1] ?? null
}

function parseHunkHeader(line: string): { oldStart: number; newStart: number } | null {
  const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
  if (!match) return null
  return { oldStart: Number(match[1]), newStart: Number(match[2]) }
}

function findUnifiedDiffStart(content: string): number {
  const start = content.indexOf('diff --git ')
  if (start === 0 || (start > 0 && content[start - 1] === '\n')) {
    return start
  }
  return -1
}

export { formatDiffRows }
export type { DisplayMessage }
