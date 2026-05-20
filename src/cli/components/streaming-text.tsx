import React from 'react'
import { Text } from 'ink'

interface StreamingTextProps {
  text: string
}

export function StreamingText({ text }: StreamingTextProps): React.ReactElement {
  return <Text>{text}</Text>
}
