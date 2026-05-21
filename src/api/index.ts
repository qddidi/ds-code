export { DeepSeekClient, type StreamCallbacks, type ChatModel, type DeepSeekModel } from './deepseek.js'
export { parseSSEStream, type StreamEvent } from './stream.js'
export { withRetry, type RetryOptions } from './retry.js'
export {
  type ChatClientConfig,
  type ChatMessage,
  type ChatCompletionRequest,
  type ChatCompletionResponse,
  type ChatCompletionChoice,
  type DeepSeekClientConfig,
  type Provider,
  type StreamChunk,
  type StreamDelta,
  type StreamToolCallDelta,
  type ToolCall,
  type ToolDefinition,
  ApiError,
  AuthenticationError,
  NetworkError,
  RateLimitError,
} from './types.js'
