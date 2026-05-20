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
          {msg.role === 'tool' && (
            <Text dimColor>{msg.content}</Text>
          )}
        </Box>
      )}
    </Static>
  )
}

export type { DisplayMessage }
