import { describe, expect, it } from 'vitest'
import { formatDiffRows } from '../../src/cli/components/message-list.js'

describe('formatDiffRows', () => {
  it('formats unified diff as concise line-numbered rows', () => {
    const rows = formatDiffRows([
      'diff --git a/D:\\ds\\testdiff.ts b/D:\\ds\\testdiff.ts',
      '--- a/D:\\ds\\testdiff.ts',
      '+++ b/D:\\ds\\testdiff.ts',
      '@@ -74,8 +74,8 @@',
      ' type Status = \'idle\'',
      '-const visibleToolHistoryLimit = 8',
      '-const streamingFlushIntervalMs = 50',
      '+const visibleToolHistoryLimit = 9',
      '+const streamingFlushIntervalMs = 60',
    ].join('\n'))

    expect(rows).toEqual([
      { type: 'file', text: 'Update(D:\\ds\\testdiff.ts)' },
      { type: 'hunk', oldLine: 74, newLine: 74 },
      { type: 'context', oldLine: 74, newLine: 74, text: 'type Status = \'idle\'' },
      { type: 'remove', oldLine: 75, text: 'const visibleToolHistoryLimit = 8' },
      { type: 'remove', oldLine: 76, text: 'const streamingFlushIntervalMs = 50' },
      { type: 'add', newLine: 75, text: 'const visibleToolHistoryLimit = 9' },
      { type: 'add', newLine: 76, text: 'const streamingFlushIntervalMs = 60' },
    ])
  })
})
