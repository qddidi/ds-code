import React from 'react'
import { Box, Text } from 'ink'
import type { SlashCommand } from '../commands.js'

interface AutocompleteProps {
  matches: SlashCommand[]
  selectedIndex: number
}

export function Autocomplete({ matches, selectedIndex }: AutocompleteProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginLeft={2}>
      {matches.map((cmd, i) => (
        <Box key={cmd.name}>
          <Text color={i === selectedIndex ? 'cyan' : undefined}>
            {i === selectedIndex ? '› ' : '  '}
          </Text>
          <Text bold={i === selectedIndex}>{cmd.name}</Text>
          <Text dimColor> {cmd.description}</Text>
        </Box>
      ))}
    </Box>
  )
}
