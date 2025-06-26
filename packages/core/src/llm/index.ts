// LLM module - Language Model abstraction and utilities
export const LLM_MODULE_VERSION = '2.0.0';

// Core LLM client interfaces and utilities
export {
  LLMClient as BaseLLMClient,
  LLMClientFactory,
  LLMUtils,
  type LLMModelConfig,
  type LLMStreamChunk
} from './client.js';

// LLM response parsers
export {
  parseSuggestedCommand,
  parseLLMThought,
  parseLLMPlan,
  parseLLMInstruction,
  parseLLMDecision,
  parseLLMSummary,
  extractDecisionTypeAndMessage,
  parseChecklistItems,
  extractResponseContent,
  validateResponseFormat,
  extractAllTags
} from './parsers.js';

// Re-export base types for convenience
export type { LLMClient, LLMResponse, LLMChunk, LLMRequest, LLMProvider, LLMError } from '../types/index.js';

// TODO: Uncomment when provider implementations are added
// export { OllamaClient } from './providers/ollama-client.js';
// export { OpenAIClient } from './providers/openai-client.js';
// export { AnthropicClient } from './providers/anthropic-client.js';
