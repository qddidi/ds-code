import React from 'react'
import { Box, Text } from 'ink'

interface PermissionPromptProps {
  tool: string
  args: Record<string, unknown>
  selectedIndex: number
}

const OPTIONS = [
  { label: 'Yes', description: 'allow once', color: 'green' },
  { label: 'Always', description: 'allow matching requests', color: 'blue' },
  { label: 'No', description: 'deny', color: 'red' },
] as const

export function PermissionPrompt({ tool, args, selectedIndex }: PermissionPromptProps): React.ReactElement {
  const summary = tool === 'bash'
    ? String(args.command ?? '')
    : tool === 'write_file' || tool === 'edit_file'
      ? String(args.file_path ?? '')
      : JSON.stringify(args).slice(0, 80)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text color="yellow" bold>Permission required</Text>
      <Text>
        <Text bold>{tool}</Text>
        <Text dimColor> {summary}</Text>
      </Text>
      <Text> </Text>
      {OPTIONS.map((option, index) => {
        const selected = index === selectedIndex
        return (
          <Text key={option.label}>
            <Text color={selected ? 'cyan' : 'gray'}>{selected ? '❯' : ' '} </Text>
            <Text color={selected ? option.color : 'white'} bold={selected}>{option.label}</Text>
            <Text dimColor> — {option.description}</Text>
          </Text>
        )
      })}
      <Text dimColor>  ↑↓ navigate  ⏎ select  Esc deny</Text>
    </Box>
  )
}
