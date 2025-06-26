// Agents module - Multi-agent system for terminal automation
export const AGENTS_MODULE_VERSION = '2.0.0';

// Base agent infrastructure
export {
  BaseAgent,
  AgentFactory,
  AgentUtils,
  type BaseAgentContext,
  type AgentResponseData
} from './base.js';

// Specific agent implementations
export {
  PlanAgent,
  type PlanResponse
} from './planner.js';

export {
  ActionAgent,
  type ActionResponse
} from './actor.js';

export {
  EvaluationAgent,
  type EvaluationResponse,
  type EvaluationDecisionType
} from './evaluator.js';

// Agent orchestration
export {
  AgentOrchestrator,
  TaskStatus,
  type TaskState,
  type OrchestratorConfig,
  type TaskResult
} from './orchestrator.js';

// Re-export base types for convenience
export type { AgentContext, AgentResponse, AgentEvent, AgentType, AgentDecision } from '../types/index.js';
