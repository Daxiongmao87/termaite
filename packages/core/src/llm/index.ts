// LLM module - LLM abstraction layer with provider support
export const LLM_MODULE_VERSION = '2.0.0';

// Enhanced LLM implementations (extend existing interfaces)
export { 
  LLMClient as BaseLLMClient,
  LLMClientFactory,
  LLMUtils,
  type LLMModelConfig,
  type LLMStreamChunk
} from './client.js';

// Re-export existing types from types module for convenience
export type { 
  LLMProvider,
  LLMRequest,
  LLMResponse,
  LLMError,
  LLMChunk,
  LLMClient
} from '../types/index.js';

// TODO: Uncomment when provider implementations are added
// export { OllamaClient } from './providers/ollama-client.js';
// export { OpenAIClient } from './providers/openai-client.js';
// export { AnthropicClient } from './providers/anthropic-client.js';
