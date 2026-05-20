import chalk from 'chalk'
import { matchSlashCommands, clampSelection, type SlashCommand } from './commands.js'

export class SlashAutocomplete {
  private renderedLines = 0
  private selectedIndex = 0
  private currentMatches: SlashCommand[] = []
  private active = false

  update(line: string): void {
    if (!line.startsWith('/') || line.includes(' ')) {
      this.hide()
      return
    }

    this.currentMatches = matchSlashCommands(line)
    if (this.currentMatches.length === 0) {
      this.hide()
      return
    }

    this.selectedIndex = clampSelection(this.selectedIndex, this.currentMatches.length)
    this.active = true
    this.render()
  }

  moveUp(): void {
    if (!this.active) return
    this.selectedIndex = clampSelection(this.selectedIndex - 1, this.currentMatches.length)
    this.render()
  }

  moveDown(): void {
    if (!this.active) return
    this.selectedIndex = clampSelection(this.selectedIndex + 1, this.currentMatches.length)
    this.render()
  }

  getSelected(): string | null {
    if (!this.active || this.currentMatches.length === 0) return null
    return this.currentMatches[this.selectedIndex]?.name ?? null
  }

  isActive(): boolean {
    return this.active
  }

  hide(): void {
    this.clear()
    this.active = false
    this.currentMatches = []
    this.selectedIndex = 0
  }

  private render(): void {
    this.clear()

    const lines: string[] = []
    for (let i = 0; i < this.currentMatches.length; i++) {
      const cmd = this.currentMatches[i]!
      const marker = i === this.selectedIndex ? chalk.cyan('›') : ' '
      lines.push(`  ${marker} ${chalk.bold(cmd.name)} ${chalk.dim(cmd.description)}`)
    }

    if (lines.length > 0) {
      process.stdout.write('\n' + lines.join('\n'))
      this.renderedLines = lines.length
      // Move cursor back up to the input line
      process.stdout.write(`\x1b[${this.renderedLines}A\r`)
    }
  }

  private clear(): void {
    if (this.renderedLines > 0) {
      // Save cursor, move down, clear lines, restore cursor
      process.stdout.write('\x1b[s')
      for (let i = 0; i < this.renderedLines; i++) {
        process.stdout.write('\x1b[B\x1b[2K')
      }
      process.stdout.write('\x1b[u')
      this.renderedLines = 0
    }
  }
}
