import chalk from 'chalk'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class Spinner {
  private interval: ReturnType<typeof setInterval> | null = null
  private frameIndex = 0
  private _isSpinning = false
  private message: string

  constructor(message = 'Thinking...') {
    this.message = message
  }

  get isSpinning(): boolean {
    return this._isSpinning
  }

  start(message?: string): void {
    if (this._isSpinning) return
    if (message) this.message = message
    this._isSpinning = true
    this.frameIndex = 0

    this.interval = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frameIndex % SPINNER_FRAMES.length]
      process.stderr.write(`\r${chalk.cyan(frame)} ${this.message}`)
      this.frameIndex++
    }, 80)
  }

  stop(): void {
    if (!this._isSpinning) return
    this._isSpinning = false
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    process.stderr.write('\r\x1b[K')
  }

  setText(message: string): void {
    this.message = message
  }
}
