import { EventEmitter } from 'events';
import { 
  AgentEvent, 
  AgentResponse, 
  LLMChunk, 
  ConfigurationOptions,
  StreamEvent,
  StreamEventType,
  AgentType
} from '../types/index.js';

/**
 * Agent execution context containing configuration and runtime information
 */
export interface BaseAgentContext {
  /** Unique identifier for the agent execution session */
  sessionId: string;
  
  /** Agent configuration settings */
  config: ConfigurationOptions;
  
  /** Current task description */
  task: string;
  
  /** Operation mode */
  mode: 'normal' | 'gremlin' | 'goblin';
  
  /** Execution environment information */
  environment: {
    workingDirectory: string;
    platform: string;
    nodeVersion: string;
  };
  
  /** Previous agent responses in the chain */
  previousResponses?: AgentResponse[];
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Agent response interface defining the structure of agent outputs
 */
export interface AgentResponseData {
  /** Unique identifier for this response */
  id: string;
  
  /** Type of agent that generated this response */
  agentType: 'plan' | 'action' | 'evaluation';
  
  /** Agent execution status */
  status: 'success' | 'error' | 'partial' | 'pending';
  
  /** Main response content */
  content: string;
  
  /** Structured data associated with the response */
  data?: any;
  
  /** Commands to execute (for action agents) */
  commands?: string[];
  
  /** Evaluation results (for evaluation agents) */
  evaluation?: {
    success: boolean;
    score: number;
    feedback: string;
    suggestions?: string[];
  };
  
  /** Execution metrics */
  metrics?: {
    processingTime: number;
    tokensUsed: number;
    confidence: number;
  };
  
  /** Timestamp of response generation */
  timestamp: number;
  
  /** Any errors encountered during processing */
  error?: string;
}

/**
 * Abstract base class for all AI agents in the termaite system
 */
export abstract class BaseAgent extends EventEmitter {
  protected readonly name: string;
  protected readonly type: 'plan' | 'action' | 'evaluation';
  protected context?: BaseAgentContext;
  protected isProcessing: boolean = false;
  
  constructor(name: string, type: 'plan' | 'action' | 'evaluation') {
    super();
    this.name = name;
    this.type = type;
  }
  
  /**
   * Get the agent's name
   */
  getName(): string {
    return this.name;
  }
  
  /**
   * Get the agent's type
   */
  getType(): 'plan' | 'action' | 'evaluation' {
    return this.type;
  }
  
  /**
   * Check if the agent is currently processing
   */
  isActive(): boolean {
    return this.isProcessing;
  }
  
  /**
   * Set the execution context for the agent
   */
  setContext(context: BaseAgentContext): void {
    this.context = context;
    this.emit('contextSet', context);
  }
  
  /**
   * Get the current execution context
   */
  getContext(): BaseAgentContext | undefined {
    return this.context;
  }
  
  /**
   * Abstract method to process a task - must be implemented by subclasses
   */
  abstract process(input: string, context?: BaseAgentContext): Promise<AgentResponseData>;
  
  /**
   * Abstract method to validate input - must be implemented by subclasses
   */
  abstract validateInput(input: string): Promise<boolean>;
  
  /**
   * Start processing with proper event emission
   */
  protected async startProcessing(input: string): Promise<void> {
    if (this.isProcessing) {
      throw new Error(`Agent ${this.name} is already processing`);
    }
    
    this.isProcessing = true;
    
    const event: StreamEvent = {
      type: 'agent_start',
      timestamp: Date.now(),
      data: { input, agentName: this.name, agentType: this.type }
    };
    
    this.emit('agentStart', event);
  }
  
  /**
   * Finish processing with proper event emission
   */
  protected async finishProcessing(response: AgentResponseData): Promise<void> {
    this.isProcessing = false;
    
    const event: StreamEvent = {
      type: 'agent_response',
      timestamp: Date.now(),
      data: { response, agentName: this.name, agentType: this.type }
    };
    
    this.emit('agentComplete', event);
  }
  
  /**
   * Emit thinking events during processing
   */
  protected emitThinking(message: string): void {
    const event: StreamEvent = {
      type: 'agent_thinking',
      timestamp: Date.now(),
      data: { message, agentName: this.name, agentType: this.type }
    };
    
    this.emit('agentThinking', event);
  }
  
  /**
   * Emit error events
   */
  protected emitError(error: string | Error): void {
    const errorMessage = error instanceof Error ? error.message : error;
    
    const event: StreamEvent = {
      type: 'error',
      timestamp: Date.now(),
      data: { error: errorMessage, agentName: this.name, agentType: this.type }
    };
    
    this.emit('agentError', event);
  }
  
  /**
   * Create a standardized response object
   */
  protected createResponse(
    content: string,
    status: 'success' | 'error' | 'partial' | 'pending' = 'success',
    additionalData?: Partial<AgentResponseData>
  ): AgentResponseData {
    return {
      id: `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentType: this.type,
      status,
      content,
      timestamp: Date.now(),
      ...additionalData
    };
  }
  
  /**
   * Cleanup resources when agent is destroyed
   */
  destroy(): void {
    this.removeAllListeners();
    this.isProcessing = false;
    this.context = undefined;
  }
}

/**
 * Agent factory for creating instances of different agent types
 */
export class AgentFactory {
  private static registeredAgents: Map<string, new (name: string) => BaseAgent> = new Map();
  
  /**
   * Register a new agent class
   */
  static registerAgent(type: string, agentClass: new (name: string) => BaseAgent): void {
    this.registeredAgents.set(type, agentClass);
  }
  
  /**
   * Create an agent instance of the specified type
   */
  static createAgent(type: string, name: string): BaseAgent {
    const AgentClass = this.registeredAgents.get(type);
    if (!AgentClass) {
      throw new Error(`Unknown agent type: ${type}`);
    }
    
    return new AgentClass(name);
  }
  
  /**
   * Get list of registered agent types
   */
  static getRegisteredTypes(): string[] {
    return Array.from(this.registeredAgents.keys());
  }
}

/**
 * Agent utilities for common operations
 */
export class AgentUtils {
  /**
   * Validate agent response structure
   */
  static validateResponse(response: any): response is AgentResponseData {
    return (
      typeof response === 'object' &&
      typeof response.id === 'string' &&
      typeof response.agentType === 'string' &&
      typeof response.status === 'string' &&
      typeof response.content === 'string' &&
      typeof response.timestamp === 'number'
    );
  }
  
  /**
   * Calculate processing metrics
   */
  static calculateMetrics(startTime: number, tokensUsed: number = 0, confidence: number = 1.0) {
    return {
      processingTime: Date.now() - startTime,
      tokensUsed,
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }
  
  /**
   * Create a stream event from agent data
   */
  static createStreamEvent(
    type: StreamEventType,
    agent: BaseAgent,
    data: any
  ): StreamEvent {
    return {
      type,
      data: { ...data, agentName: agent.getName(), agentType: agent.getType() },
      timestamp: Date.now()
    };
  }
  
  /**
   * Generate a unique session ID
   */
  static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default BaseAgent;
