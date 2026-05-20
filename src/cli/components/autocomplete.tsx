import React from 'react'
import { Box, Text } from 'ink'
import type { SlashCommand } from '../commands.js'

interface AutocompleteProps {
  matches: SlashCommand[]
  selectedIndex: number
}

export function Autocomplete({ matches, selectedIndex }: AutocompleteProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box borderStyle="round" borderColor="gray" flexDirection="column" paddingLeft={1} paddingRight={1}>
        {matches.map((cmd, i) => {
          const isSelected = i === selectedIndex
          return (
            <Box key={cmd.name}>
              <Text color={isSelected ? 'cyan' : 'gray'}>{isSelected ? '❯' : ' '} </Text>
              <Text color={isSelected ? 'cyan' : 'white'} bold={isSelected}>{cmd.name.padEnd(10)}</Text>
              <Text color="gray"> {cmd.description}</Text>
            </Box>
          )
        })}
      </Box>
      <Text dimColor>  ↑↓ navigate  ⏎/Tab select  Esc dismiss</Text>
    </Box>
  )
}
