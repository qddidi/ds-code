import React from 'react'
import { Box, Text } from 'ink'
import Spinner from 'ink-spinner'
import { basename } from 'node:path'

interface ToolCallDisplayProps {
  name: string
  args: Record<string, unknown>
  done?: boolean
  error?: boolean
}

export function ToolCallDisplay({ name, args, done, error }: ToolCallDisplayProps): React.ReactElement {
  const { label, detail } = formatTool(name, args)
  const icon = done
    ? (error ? <Text color="red">✗</Text> : <Text color="green">✓</Text>)
    : <Text color="cyan"><Spinner type="dots" /></Text>

  return (
    <Box>
      <Text dimColor>  </Text>
      {icon}
      <Text> </Text>
      <Text bold>{label}</Text>
      {detail && <Text dimColor> {detail}</Text>}
    </Box>
  )
}

function formatTool(name: string, args: Record<string, unknown>): { label: string; detail: string } {
  switch (name) {
    case 'read_file':
      return { label: 'Read', detail: basename(String(args.file_path ?? '')) }
    case 'write_file':
      return { label: 'Write', detail: basename(String(args.file_path ?? '')) }
    case 'edit_file':
      return { label: 'Edit', detail: basename(String(args.file_path ?? '')) }
    case 'glob':
      return { label: 'Glob', detail: String(args.pattern ?? '') }
    case 'grep':
      return { label: 'Grep', detail: String(args.pattern ?? '') }
    case 'bash':
      return { label: 'Bash', detail: truncate(String(args.command ?? ''), 50) }
    case 'list_dir':
      return { label: 'List', detail: String(args.path ?? '.') }
    default:
      return { label: name, detail: '' }
  }
}

function truncate(str: string, max: number): string {
  const oneLine = str.replace(/\n/g, ' ')
  if (oneLine.length <= max) return oneLine
  return oneLine.slice(0, max - 1) + '…'
}
