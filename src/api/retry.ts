import { NetworkError, RateLimitError } from './types.js'

export interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  onRetry?: (error: Error, attempt: number, delayMs: number) => void
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (!(err instanceof Error)) throw err
      if (!isRetryable(err)) throw err

      lastError = err

      if (attempt >= opts.maxRetries) break

      const delay = calculateDelay(err, attempt, opts)
      opts.onRetry?.(err, attempt + 1, delay)
      await sleep(delay)
    }
  }

  throw lastError!
}

function isRetryable(err: Error): boolean {
  if (err instanceof NetworkError) return true
  if (err instanceof RateLimitError) return true
  return false
}

function calculateDelay(err: Error, attempt: number, opts: RetryOptions): number {
  if (err instanceof RateLimitError && err.retryAfter) {
    return Math.min(err.retryAfter * 1000, opts.maxDelayMs)
  }
  const exponential = opts.baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * opts.baseDelayMs
  return Math.min(exponential + jitter, opts.maxDelayMs)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
