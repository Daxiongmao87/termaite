// Streaming module - Streaming infrastructure with event management
export const STREAMING_MODULE_VERSION = '2.0.0';

// Core streaming infrastructure
export {
  BaseStreamManager,
  StreamStatus,
  StreamPriority,
  type EnhancedStreamEvent,
  type StreamSubscription,
  type StreamStats,
  type StreamIterator,
  type StreamProcessor,
  type StreamBuffer,
  type StreamConfig
} from './types.js';

// Re-export base types for convenience
export type { StreamEvent, StreamEventType } from '../types/index.js';

// TODO: Uncomment when concrete implementations are added
// export { StreamEventEmitter } from './stream-event-emitter.js';
// export { StreamProcessor } from './stream-processor.js';
// export { MemoryStreamBuffer } from './memory-buffer.js';
