/**
 * Core Type System for term.ai.te
 * 
 * This file provides a comprehensive type system that supports:
 * - Multi-agent architecture (Plan, Action, Evaluation agents)
 * - LLM integration and streaming
 * - Configuration management
 * - Command execution and safety
 * - Task management and state
 * - Real-time event streaming
 */

// Re-export all types from the types directory
export * from './types/index.js';

// Additional type utilities and aliases
export type Maybe<T> = T | null | undefined;
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Version information
export const CORE_VERSION = '1.0.0';

// Type guards for runtime type checking
export function isAgentType(value: string): value is AgentType {
  return ['plan', 'action', 'evaluation'].includes(value);
}

export function isOperationMode(value: string): value is OperationMode {
  return ['normal', 'gremlin', 'goblin'].includes(value);
}

export function isAgentDecision(value: string): value is AgentDecision {
  return ['CONTINUE_PLAN', 'REVISE_PLAN', 'TASK_COMPLETE', 'TASK_FAILED', 'CLARIFY_USER'].includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return ['IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(value as TaskStatus);
}

export function isStreamEventType(value: string): value is StreamEventType {
  return [
    'agent_start',
    'agent_thinking',
    'agent_response',
    'command_start',
    'command_output',
    'command_complete',
    'task_progress',
    'error',
    'system'
  ].includes(value);
}

// Import types for type guards
import type {
  AgentType,
  OperationMode,
  AgentDecision,
  TaskStatus,
  StreamEventType
} from './types/index.js';
