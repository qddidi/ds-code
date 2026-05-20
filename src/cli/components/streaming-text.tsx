import React from 'react'
import { Box, Text } from 'ink'

interface StreamingTextProps {
  text: string
}

export function StreamingText({ text }: StreamingTextProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>{text}<Text color="cyan">▊</Text></Text>
    </Box>
  )
}
