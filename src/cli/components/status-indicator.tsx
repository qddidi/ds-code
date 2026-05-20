import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'

interface StatusIndicatorProps {
  label?: string
}

export function StatusIndicator({ label = 'Thinking...' }: StatusIndicatorProps): React.ReactElement {
  return (
    <Box>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text dimColor> {label}</Text>
    </Box>
  )
}
