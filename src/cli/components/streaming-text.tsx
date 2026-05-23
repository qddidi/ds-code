import React from 'react'
import { Box, Text, useStdout } from 'ink'

interface StreamingTextProps {
  text: string
}

interface StreamingViewport {
  columns?: number
  rows?: number
  reservedRows?: number
}

interface VisibleStreamingText {
  text: string
  omittedRows: number
}

export function getVisibleStreamingText(text: string, viewport: StreamingViewport = {}): VisibleStreamingText {
  const columns = Math.max(1, viewport.columns ?? 80)
  const rows = Math.max(1, viewport.rows ?? 24)
  const reservedRows = viewport.reservedRows ?? 6
  const maxRows = Math.max(1, rows - reservedRows)
  const lines = text.split('\n')

  const lineRows = (line: string): number => Math.max(1, Math.ceil(line.length / columns))
  const totalRows = lines.reduce((sum, line) => sum + lineRows(line), 0)
  if (totalRows <= maxRows) {
    return { text, omittedRows: 0 }
  }

  let remainingRows = maxRows
  const visibleLines: string[] = []

  for (let i = lines.length - 1; i >= 0 && remainingRows > 0; i--) {
    const line = lines[i] ?? ''
    const rowsForLine = lineRows(line)
    if (rowsForLine <= remainingRows) {
      visibleLines.unshift(line)
      remainingRows -= rowsForLine
      continue
    }

    const visibleChars = remainingRows * columns
    visibleLines.unshift(line.slice(-visibleChars))
    remainingRows = 0
  }

  return {
    text: visibleLines.join('\n'),
    omittedRows: totalRows - maxRows,
  }
}

export function StreamingText({ text }: StreamingTextProps): React.ReactElement {
  const { stdout } = useStdout()
  const visible = getVisibleStreamingText(text, {
    columns: stdout?.columns,
    rows: stdout?.rows,
  })

  return (
    <Box flexDirection="column">
      {visible.omittedRows > 0 && <Text dimColor>... ({visible.omittedRows} terminal rows above)</Text>}
      <Text>{visible.text}<Text color="cyan">▊</Text></Text>
    </Box>
  )
}
