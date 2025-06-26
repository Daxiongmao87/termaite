import { 
  LLMChunk, 
  LLMResponse,
  LLMClient as ILLMClient,
  LLMProvider,
  LLMRequest,
  LLMError,
  StreamEvent 
} from '../types/index.js';
import { EventEmitter } from 'events';

/**
 * LLM Model configuration
 */
export interface LLMModelConfig {
  /** Model name/identifier */
  name: string;
  
  /** Provider that hosts this model */
  provider: LLMProvider;
  
  /** API endpoint URL (for hosted models) */
  endpoint?: string;
  
  /** Maximum context length in tokens */
  maxTokens?: number;
  
  /** Temperature for randomness (0-1) */
  temperature?: number;
  
  /** Top-p sampling parameter */
  topP?: number;
  
  /** Top-k sampling parameter */
  topK?: number;
  
  /** Custom model parameters */
  parameters?: Record<string, any>;
}

/**
 * Enhanced LLM Chunk for streaming responses
 */
export interface LLMStreamChunk extends LLMChunk {
  /** Chunk sequence number */
  sequence: number;
  
  /** Whether this is the final chunk */
  isFinal: boolean;
  
  /** Token delta (new tokens in this chunk) */
  delta: string;
  
  /** Provider-specific metadata */
  providerData?: any;
}

/**
 * LLM Client implementation - extends the base interface
 */
export abstract class LLMClient extends EventEmitter implements ILLMClient {
  protected config: LLMModelConfig;
  protected provider: LLMProvider;
  
  constructor(config: LLMModelConfig) {
    super();
    this.config = config;
    this.provider = config.provider;
  }
  
  /**
   * Get the provider type
   */
  getProvider(): LLMProvider {
    return this.provider;
  }
  
  /**
   * Get the current configuration
   */
  getConfig(): LLMModelConfig {
    return { ...this.config };
  }
  
  /**
   * Update the configuration
   */
  updateConfig(config: Partial<LLMModelConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * Check if the client is ready to make requests
   */
  abstract isReady(): Promise<boolean>;
  
  /**
   * Get context limit (implements ILLMClient)
   */
  getContextLimit(): number {
    return this.config.maxTokens || 4096;
  }
  
  /**
   * Generate a non-streaming response (implements ILLMClient)
   */
  abstract generate(prompt: string): Promise<LLMResponse>;
  
  /**
   * Generate a streaming response (implements ILLMClient)
   */
  abstract stream(prompt: string): AsyncIterable<LLMChunk>;
  
  /**
   * Generate a streaming response with enhanced chunks
   */
  abstract generateStream(request: LLMRequest): AsyncGenerator<LLMStreamChunk, LLMResponse, unknown>;
  
  /**
   * Generate with full request configuration
   */
  abstract generateWithConfig(request: LLMRequest): Promise<LLMResponse>;
  
  /**
   * Validate that a request is properly formatted
   */
  validateRequest(request: LLMRequest): LLMError | null {
    if (!request.prompt || request.prompt.trim().length === 0) {
      return this.createError('Empty prompt provided', 'INVALID_PROMPT', false);
    }
    
    if (request.maxTokens && request.maxTokens <= 0) {
      return this.createError('Invalid maxTokens value', 'INVALID_TOKENS', false);
    }
    
    return null;
  }
  
  /**
   * Create a standardized error object
   */
  protected createError(
    message: string, 
    code: string = 'UNKNOWN_ERROR', 
    retryable: boolean = true
  ): LLMError {
    return {
      code,
      message,
      retryable,
      timestamp: Date.now()
    };
  }
  
  /**
   * Emit streaming events
   */
  protected emitStreamEvent(type: string, data: any): void {
    const event: StreamEvent = {
      type,
      data: { provider: this.provider, ...data },
      timestamp: Date.now()
    };
    
    this.emit('streamEvent', event);
  }
  
  /**
   * Calculate token usage (basic estimation if provider doesn't provide)
   */
  protected estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Cleanup resources
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

/**
 * LLM Client Factory for creating provider-specific clients
 */
export class LLMClientFactory {
  private static registeredProviders: Map<LLMProvider, new (config: LLMModelConfig) => LLMClient> = new Map();
  
  /**
   * Register a new LLM provider client
   */
  static registerProvider(provider: LLMProvider, clientClass: new (config: LLMModelConfig) => LLMClient): void {
    this.registeredProviders.set(provider, clientClass);
  }
  
  /**
   * Create an LLM client for the specified provider
   */
  static createClient(config: LLMModelConfig): LLMClient {
    const ClientClass = this.registeredProviders.get(config.provider);
    if (!ClientClass) {
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
    
    return new ClientClass(config);
  }
  
  /**
   * Get list of registered providers
   */
  static getRegisteredProviders(): LLMProvider[] {
    return Array.from(this.registeredProviders.keys());
  }
  
  /**
   * Check if a provider is registered
   */
  static isProviderSupported(provider: LLMProvider): boolean {
    return this.registeredProviders.has(provider);
  }
}

/**
 * LLM Utilities for common operations
 */
export class LLMUtils {
  /**
   * Validate LLM response structure
   */
  static validateResponse(response: any): response is LLMResponse {
    return (
      typeof response === 'object' &&
      typeof response.content === 'string' &&
      typeof response.success === 'boolean'
    );
  }
  
  /**
   * Merge multiple stream chunks into a complete response
   */
  static mergeStreamChunks(chunks: LLMStreamChunk[]): string {
    return chunks
      .sort((a, b) => a.sequence - b.sequence)
      .map(chunk => chunk.delta)
      .join('');
  }
  
  /**
   * Create a default model configuration
   */
  static createDefaultConfig(provider: LLMProvider, modelName: string): LLMModelConfig {
    const defaults: Record<LLMProvider, Partial<LLMModelConfig>> = {
      ollama: {
        endpoint: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 4096
      },
      openai: {
        endpoint: 'https://api.openai.com/v1',
        temperature: 0.7,
        maxTokens: 4096
      },
      anthropic: {
        endpoint: 'https://api.anthropic.com/v1',
        temperature: 0.7,
        maxTokens: 4096
      },
      custom: {
        temperature: 0.7,
        maxTokens: 4096
      }
    };
    
    return {
      name: modelName,
      provider,
      ...defaults[provider]
    };
  }
  
  /**
   * Calculate cost estimation (placeholder - would need actual pricing data)
   */
  static estimateCost(provider: LLMProvider, usage?: { promptTokens: number; completionTokens: number }): number {
    if (!usage) return 0;
    
    // Placeholder pricing (would need real pricing data)
    const pricing: Record<LLMProvider, { prompt: number; completion: number }> = {
      openai: { prompt: 0.0015, completion: 0.002 }, // per 1K tokens
      anthropic: { prompt: 0.008, completion: 0.024 },
      ollama: { prompt: 0, completion: 0 }, // Local model
      custom: { prompt: 0, completion: 0 }
    };
    
    const rates = pricing[provider] || { prompt: 0, completion: 0 };
    const promptCost = (usage.promptTokens / 1000) * rates.prompt;
    const completionCost = (usage.completionTokens / 1000) * rates.completion;
    
    return promptCost + completionCost;
  }
}

export default LLMClient;
