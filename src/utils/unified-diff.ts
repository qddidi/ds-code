type DiffLineType = 'context' | 'add' | 'remove'

interface DiffLine {
  type: DiffLineType
  line: string
  oldLine?: number
  newLine?: number
}

const DIFF_CONTEXT_LINES = 3

export function createUnifiedDiff(filePath: string, before: string, after: string): string {
  if (before === after) return ''

  const oldPath = `a/${filePath}`
  const newPath = `b/${filePath}`
  return createUnifiedDiffWithPaths({ oldPath, newPath, before, after })
}

export function createNewFileDiff(filePath: string, content: string): string {
  if (content.length === 0) return ''

  return createUnifiedDiffWithPaths({
    oldPath: '/dev/null',
    newPath: `b/${filePath}`,
    before: '',
    after: content,
  })
}

function createUnifiedDiffWithPaths(input: {
  oldPath: string
  newPath: string
  before: string
  after: string
}): string {
  const diffLines = createDiffLines(splitLines(input.before), splitLines(input.after))
  const hunks = createHunks(diffLines)
  const lines = [
    `diff --git ${input.oldPath === '/dev/null' ? input.newPath : input.oldPath} ${input.newPath}`,
    `--- ${input.oldPath}`,
    `+++ ${input.newPath}`,
  ]

  for (const hunk of hunks) {
    lines.push(createHunkHeader(hunk), ...hunk.map(formatDiffLine))
  }

  return lines.join('\n')
}

function splitLines(content: string): string[] {
  const lines = content.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

function createDiffLines(beforeLines: string[], afterLines: string[]): DiffLine[] {
  const table = createLcsTable(beforeLines, afterLines)
  const lines: DiffLine[] = []
  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < beforeLines.length || newIndex < afterLines.length) {
    if (oldIndex < beforeLines.length && newIndex < afterLines.length && beforeLines[oldIndex] === afterLines[newIndex]) {
      lines.push({
        type: 'context',
        line: beforeLines[oldIndex] ?? '',
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      })
      oldIndex++
      newIndex++
      continue
    }

    if (
      newIndex < afterLines.length &&
      (oldIndex === beforeLines.length || table[oldIndex][newIndex + 1] > table[oldIndex + 1][newIndex])
    ) {
      lines.push({ type: 'add', line: afterLines[newIndex] ?? '', newLine: newIndex + 1 })
      newIndex++
      continue
    }

    if (oldIndex < beforeLines.length) {
      lines.push({ type: 'remove', line: beforeLines[oldIndex] ?? '', oldLine: oldIndex + 1 })
      oldIndex++
    }
  }

  return lines
}

function createLcsTable(beforeLines: string[], afterLines: string[]): number[][] {
  const table = Array.from({ length: beforeLines.length + 1 }, () => Array(afterLines.length + 1).fill(0) as number[])

  for (let oldIndex = beforeLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = afterLines.length - 1; newIndex >= 0; newIndex--) {
      table[oldIndex][newIndex] = beforeLines[oldIndex] === afterLines[newIndex]
        ? table[oldIndex + 1][newIndex + 1] + 1
        : Math.max(table[oldIndex + 1][newIndex], table[oldIndex][newIndex + 1])
    }
  }

  return table
}

function createHunks(lines: DiffLine[]): DiffLine[][] {
  const hunks: DiffLine[][] = []
  let index = 0

  while (index < lines.length) {
    const nextChange = findNextChange(lines, index)
    if (nextChange === -1) break

    const hunkStart = Math.max(0, nextChange - DIFF_CONTEXT_LINES)
    let hunkEnd = nextChange
    let trailingContext = 0
    let cursor = nextChange + 1

    while (cursor < lines.length) {
      if (lines[cursor]?.type === 'context') {
        trailingContext++
        if (trailingContext > DIFF_CONTEXT_LINES) break
      } else {
        trailingContext = 0
        hunkEnd = cursor
      }
      cursor++
    }

    hunkEnd = Math.min(lines.length - 1, hunkEnd + DIFF_CONTEXT_LINES)
    hunks.push(lines.slice(hunkStart, hunkEnd + 1))
    index = hunkEnd + 1
  }

  return hunks
}

function findNextChange(lines: DiffLine[], start: number): number {
  for (let index = start; index < lines.length; index++) {
    if (lines[index]?.type !== 'context') return index
  }
  return -1
}

function createHunkHeader(hunk: DiffLine[]): string {
  const oldLines = hunk.filter((line) => line.type !== 'add')
  const newLines = hunk.filter((line) => line.type !== 'remove')
  const oldStart = oldLines[0]?.oldLine ?? 0
  const newStart = newLines[0]?.newLine ?? 0

  return `@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@`
}

function formatDiffLine(line: DiffLine): string {
  if (line.type === 'add') return `+${line.line}`
  if (line.type === 'remove') return `-${line.line}`
  return ` ${line.line}`
}
