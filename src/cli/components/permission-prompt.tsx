import React from 'react'
import { Box, Text, useInput } from 'ink'

interface PermissionPromptProps {
  tool: string
  args: Record<string, unknown>
  onResolve?: (answer: 'yes' | 'always' | 'no') => void
}

export function PermissionPrompt({ tool, args, onResolve }: PermissionPromptProps): React.ReactElement {
  useInput((input) => {
    if (!onResolve) return
    const key = input.toLowerCase()
    if (key === 'y') onResolve('yes')
    else if (key === 'a') onResolve('always')
    else if (key === 'n') onResolve('no')
  })

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
      <Text>
        <Text color="green" bold>[Y]</Text><Text>es  </Text>
        <Text color="blue" bold>[A]</Text><Text>lways  </Text>
        <Text color="red" bold>[N]</Text><Text>o</Text>
      </Text>
    </Box>
  )
}
