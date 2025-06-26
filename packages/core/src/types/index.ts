// Agent-related types
export interface AgentContext {
  userPrompt: string;
  currentPlan?: string;
  currentInstruction?: string;
  lastAction?: string;
  lastResult?: string;
  userClarification?: string;
  iteration: number;
  retryCount: number;
}

export interface AgentResponse {
  success: boolean;
  content: string;
  thought?: string;
  decision?: string;
  instruction?: string;
  error?: string;
}

export interface AgentEvent {
  type: 'plan' | 'action' | 'evaluate';
  phase: string;
  content: string;
  timestamp: number;
  agentId: string;
}

// Enhanced Agent types
export type AgentType = 'plan' | 'action' | 'evaluation';

export interface BaseAgentInterface {
  id: string;
  type: AgentType;
  execute(input: AgentInput): Promise<AgentResponse>;
  reset(): void;
}

export interface AgentInput {
  context: AgentContext;
  config: CoreConfig;
  prompt: string;
}

export interface AgentState {
  isActive: boolean;
  lastExecution?: number;
  errorCount: number;
  currentPhase: AgentPhase;
}

// Decision types from Python codebase
export type AgentDecision = 
  | 'CONTINUE_PLAN'
  | 'REVISE_PLAN'
  | 'TASK_COMPLETE'
  | 'TASK_FAILED'
  | 'CLARIFY_USER';

// LLM-related types
export interface LLMChunk {
  text: string;
  done: boolean;
  error?: string;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface LLMClient {
  stream(prompt: string): AsyncIterable<LLMChunk>;
  generate(prompt: string): Promise<LLMResponse>;
  getContextLimit(): number;
}

// Enhanced LLM types
export type LLMProvider = 'ollama' | 'openai' | 'anthropic' | 'custom';

export interface LLMRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  system?: string;
}

export interface LLMError {
  code: string;
  message: string;
  retryable: boolean;
  timestamp: number;
}

export interface LLMProviderConfig {
  type: LLMProvider;
  endpoint: string;
  apiKey?: string;
  model: string;
  timeout: number;
  retries: number;
}

// Configuration types
export interface CoreConfig {
  llm: {
    endpoint: string;
    model: string;
    contextLimit: number;
    timeout: number;
    apiKey?: string;
  };
  agents: {
    retryLimits: {
      planner: number;
      action: number;
      evaluator: number;
    };
  };
  commands: {
    timeout: number;
    allowedCommands: Record<string, string>;
    blacklistedCommands: string[];
  };
  context: {
    maxTokens: number;
    compactThreshold: number;
  };
  ui: {
    streaming: boolean;
  };
}

// Enhanced Configuration types from Python codebase
export type OperationMode = 'normal' | 'gremlin' | 'goblin';

export interface ConfigurationOptions {
  endpoint: string;
  apiKey?: string;
  operationMode: OperationMode;
  commandTimeout: number;
  enableDebug: boolean;
  allowClarifyingQuestions: boolean;
  allowedCommands: Record<string, string>;
  blacklistedCommands: string[];
  llm: LLMProviderConfig;
}

export interface CommandPermissions {
  whitelist: Record<string, string>;
  blacklist: string[];
  mode: OperationMode;
  autoApprove: boolean;
}

// Communication types
export interface Message {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface StreamEvent {
  type: string;
  data: any;
  timestamp: number;
}

// Enhanced Streaming types
export type StreamEventType = 
  | 'agent_start'
  | 'agent_thinking' 
  | 'agent_response'
  | 'command_start'
  | 'command_output'
  | 'command_complete'
  | 'task_progress'
  | 'error'
  | 'system';

export interface EventEmitter<T = any> {
  emit(event: string, data: T): void;
  on(event: string, listener: (data: T) => void): void;
  off(event: string, listener: (data: T) => void): void;
  once(event: string, listener: (data: T) => void): void;
}

export interface StreamState {
  isStreaming: boolean;
  activeAgent?: AgentType;
  progress: number;
  startTime?: number;
  lastEvent?: StreamEvent;
}

// Command execution types
export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export interface CommandPermission {
  command: string;
  allowed: boolean;
  reason?: string;
}

// Enhanced Command types
export interface CommandExecution {
  command: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  result?: CommandResult;
}

export interface SafetyCheck {
  command: string;
  safe: boolean;
  reason?: string;
  warnings: string[];
}

// Task and state types
export interface TaskState {
  currentPlan: string;
  currentInstruction: string;
  planArray: string[];
  stepIndex: number;
  lastActionTaken: string;
  lastActionResult: string;
  userClarification: string;
  lastEvalDecision: string;
  iteration: number;
  plannerRetryCount: number;
  actionRetryCount: number;
  evalRetryCount: number;
}

export enum TaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum AgentPhase {
  PLAN = 'plan',
  ACTION = 'action',
  EVALUATE = 'evaluate',
}

// Enhanced Task Management types
export interface TaskDefinition {
  id: string;
  description: string;
  mode: OperationMode;
  config: Partial<ConfigurationOptions>;
  createdAt: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: TaskStatus;
  state: TaskState;
  agentState: Record<AgentType, AgentState>;
  events: StreamEvent[];
  startTime: number;
  endTime?: number;
  result?: TaskResult;
}

export interface TaskResult {
  success: boolean;
  finalState: TaskState;
  executionTime: number;
  commandsExecuted: CommandExecution[];
  error?: string;
  summary: string;
}

export interface TaskContext {
  execution: TaskExecution;
  config: ConfigurationOptions;
  llmClient: LLMClient;
  eventEmitter: EventEmitter;
}
