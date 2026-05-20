import React from 'react'
import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

interface InputBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  multiline?: boolean
  focus?: boolean
}

export function InputBar({ value, onChange, onSubmit, multiline = false, focus = true }: InputBarProps): React.ReactElement {
  return (
    <Box>
      <Text color="blue">{multiline ? '... ' : '> '}</Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        focus={focus}
      />
    </Box>
  )
}
