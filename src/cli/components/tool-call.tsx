import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'

interface ToolCallDisplayProps {
  name: string
  args: Record<string, unknown>
}

export function ToolCallDisplay({ name, args }: ToolCallDisplayProps): React.ReactElement {
  const summary = formatArgs(name, args)

  return (
    <Box>
      <Text color="cyan">
        <Spinner type="dots" />
      </Text>
      <Text> </Text>
      <Text color="yellow" bold>{name}</Text>
      {summary && <Text dimColor> {summary}</Text>}
    </Box>
  )
}

function formatArgs(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case 'read_file':
      return String(args.file_path ?? '')
    case 'write_file':
      return String(args.file_path ?? '')
    case 'edit_file':
      return String(args.file_path ?? '')
    case 'glob':
      return String(args.pattern ?? '')
    case 'grep':
      return String(args.pattern ?? '')
    case 'bash':
      return String(args.command ?? '').slice(0, 60)
    case 'list_dir':
      return String(args.path ?? '')
    default:
      return ''
  }
}
