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
