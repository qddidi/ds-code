import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { renderMarkdown, renderStreamingMarkdown } from '../output.js'

interface StreamingTextProps {
  text: string
  active?: boolean
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

export function getRenderedStreamingText(text: string, active: boolean, viewport: StreamingViewport = {}): string {
  if (!active) {
    return renderMarkdown(text)
  }

  return renderStreamingMarkdown(getVisibleStreamingText(text, viewport).text)
}

export function getStreamingReservedRows(): number {
  return 4
}

export function getVisibleStreamingText(text: string, viewport: StreamingViewport = {}): VisibleStreamingText {
  const columns = Math.max(1, viewport.columns ?? 80)
  const rows = Math.max(1, viewport.rows ?? 24)
  const reservedRows = viewport.reservedRows ?? getStreamingReservedRows()
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

export function StreamingText({ text, active = true }: StreamingTextProps): React.ReactElement {
  const { stdout } = useStdout()
  const visible = active ? getVisibleStreamingText(text, {
    columns: stdout?.columns,
    rows: stdout?.rows,
  }) : { text, omittedRows: 0 }

  const renderedText = getRenderedStreamingText(visible.text, active)

  return (
    <Box flexDirection="column">
      {visible.omittedRows > 0 && <Text dimColor>... ({visible.omittedRows} terminal rows above)</Text>}
      <Text>{renderedText}{active && <Text color="cyan">▊</Text>}</Text>
    </Box>
  )
}
