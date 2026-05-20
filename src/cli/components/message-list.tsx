import React from 'react'
import { Box, Text } from 'ink'

interface MessageListProps {
  messages: Array<{ role: 'user' | 'assistant' | 'tool'; content: string }>
}

export function MessageList({ messages }: MessageListProps): React.ReactElement | null {
  if (messages.length === 0) return null

  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          {msg.role === 'user' && (
            <Text>
              <Text bold color="green">You: </Text>
              <Text>{msg.content}</Text>
            </Text>
          )}
          {msg.role === 'assistant' && (
            <Text>{msg.content}</Text>
          )}
          {msg.role === 'tool' && (
            <Text dimColor>{msg.content}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}
