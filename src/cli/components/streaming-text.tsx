import React from 'react'
import { Box, Text, useStdout } from 'ink'

interface StreamingTextProps {
  text: string
}

export function StreamingText({ text }: StreamingTextProps): React.ReactElement {
  const { stdout } = useStdout()
  const maxLines = Math.max(5, (stdout?.rows ?? 24) - 6)
  const lines = text.split('\n')
  const visible = lines.length > maxLines
    ? lines.slice(-maxLines).join('\n')
    : text

  return (
    <Box flexDirection="column">
      {lines.length > maxLines && <Text dimColor>... ({lines.length - maxLines} lines above)</Text>}
      <Text>{visible}<Text color="cyan">▊</Text></Text>
    </Box>
  )
}
