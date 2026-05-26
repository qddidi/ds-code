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
      {diff.split('\n').map((line, index) => (
        <DiffLine key={index} line={line} />
      ))}
    </Box>
  )
}

function DiffLine({ line }: { line: string }): React.ReactElement {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return <Text color="green">{line}</Text>
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return <Text color="red">{line}</Text>
  }
  if (line.startsWith('@@')) {
    return <Text color="cyan">{line}</Text>
  }
  if (line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++')) {
    return <Text bold>{line}</Text>
  }
  return <Text dimColor>{line}</Text>
}

function findUnifiedDiffStart(content: string): number {
  const start = content.indexOf('diff --git ')
  if (start === 0 || (start > 0 && content[start - 1] === '\n')) {
    return start
  }
  return -1
}

export type { DisplayMessage }
