import { describe, it, expect } from 'vitest';
import {
  // Type guards
  isAgentType,
  isOperationMode,
  isAgentDecision,
  isTaskStatus,
  isStreamEventType,
  
  // Types (for testing type safety)
  type AgentType,
  type OperationMode,
  type AgentDecision,
  type TaskStatus,
  type StreamEventType,
  type AgentContext,
  type AgentResponse,
  type LLMChunk,
  type LLMResponse,
  type ConfigurationOptions,
  type TaskState,
  type StreamEvent,
  type CommandResult,
  
  // Enums
  TaskStatus as TaskStatusEnum,
  AgentPhase,
} from '../types.js';

describe('Core Type System', () => {
  describe('Type Guards', () => {
    it('should correctly identify valid agent types', () => {
      expect(isAgentType('plan')).toBe(true);
      expect(isAgentType('action')).toBe(true);
      expect(isAgentType('evaluation')).toBe(true);
      expect(isAgentType('invalid')).toBe(false);
    });

    it('should correctly identify valid operation modes', () => {
      expect(isOperationMode('normal')).toBe(true);
      expect(isOperationMode('gremlin')).toBe(true);
      expect(isOperationMode('goblin')).toBe(true);
      expect(isOperationMode('invalid')).toBe(false);
    });

    it('should correctly identify valid agent decisions', () => {
      expect(isAgentDecision('CONTINUE_PLAN')).toBe(true);
      expect(isAgentDecision('REVISE_PLAN')).toBe(true);
      expect(isAgentDecision('TASK_COMPLETE')).toBe(true);
      expect(isAgentDecision('TASK_FAILED')).toBe(true);
      expect(isAgentDecision('CLARIFY_USER')).toBe(true);
      expect(isAgentDecision('INVALID')).toBe(false);
    });

    it('should correctly identify valid task status', () => {
      expect(isTaskStatus('IN_PROGRESS')).toBe(true);
      expect(isTaskStatus('COMPLETED')).toBe(true);
      expect(isTaskStatus('FAILED')).toBe(true);
      expect(isTaskStatus('CANCELLED')).toBe(true);
      expect(isTaskStatus('INVALID')).toBe(false);
    });

    it('should correctly identify valid stream event types', () => {
      expect(isStreamEventType('agent_start')).toBe(true);
      expect(isStreamEventType('agent_thinking')).toBe(true);
      expect(isStreamEventType('command_output')).toBe(true);
      expect(isStreamEventType('error')).toBe(true);
      expect(isStreamEventType('invalid')).toBe(false);
    });
  });

  describe('Agent Types', () => {
    it('should create valid AgentContext', () => {
      const context: AgentContext = {
        userPrompt: 'test prompt',
        iteration: 1,
        retryCount: 0,
      };
      
      expect(context.userPrompt).toBe('test prompt');
      expect(context.iteration).toBe(1);
      expect(context.retryCount).toBe(0);
    });

    it('should create valid AgentResponse', () => {
      const response: AgentResponse = {
        success: true,
        content: 'response content',
        thought: 'agent thought process',
      };
      
      expect(response.success).toBe(true);
      expect(response.content).toBe('response content');
      expect(response.thought).toBe('agent thought process');
    });
  });

  describe('LLM Types', () => {
    it('should create valid LLMChunk', () => {
      const chunk: LLMChunk = {
        text: 'partial response',
        done: false,
      };
      
      expect(chunk.text).toBe('partial response');
      expect(chunk.done).toBe(false);
    });

    it('should create valid LLMResponse', () => {
      const response: LLMResponse = {
        text: 'complete response',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        model: 'test-model',
      };
      
      expect(response.text).toBe('complete response');
      expect(response.usage?.totalTokens).toBe(30);
      expect(response.model).toBe('test-model');
    });
  });

  describe('Configuration Types', () => {
    it('should create valid ConfigurationOptions', () => {
      const config: ConfigurationOptions = {
        endpoint: 'http://localhost:11434',
        operationMode: 'normal',
        commandTimeout: 30,
        enableDebug: false,
        allowClarifyingQuestions: true,
        allowedCommands: { ls: 'List directory contents' },
        blacklistedCommands: ['rm -rf /'],
        llm: {
          type: 'ollama',
          endpoint: 'http://localhost:11434',
          model: 'llama3.2:latest',
          timeout: 30,
          retries: 3,
        },
      };
      
      expect(config.operationMode).toBe('normal');
      expect(config.llm.type).toBe('ollama');
      expect(config.allowedCommands.ls).toBe('List directory contents');
    });
  });

  describe('Task State Types', () => {
    it('should create valid TaskState', () => {
      const state: TaskState = {
        currentPlan: 'test plan',
        currentInstruction: 'test instruction',
        planArray: ['step1', 'step2'],
        stepIndex: 0,
        lastActionTaken: '',
        lastActionResult: '',
        userClarification: '',
        lastEvalDecision: '',
        iteration: 1,
        plannerRetryCount: 0,
        actionRetryCount: 0,
        evalRetryCount: 0,
      };
      
      expect(state.currentPlan).toBe('test plan');
      expect(state.planArray).toHaveLength(2);
      expect(state.iteration).toBe(1);
    });

    it('should work with TaskStatus enum', () => {
      expect(TaskStatusEnum.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(TaskStatusEnum.COMPLETED).toBe('COMPLETED');
      expect(TaskStatusEnum.FAILED).toBe('FAILED');
      expect(TaskStatusEnum.CANCELLED).toBe('CANCELLED');
    });

    it('should work with AgentPhase enum', () => {
      expect(AgentPhase.PLAN).toBe('plan');
      expect(AgentPhase.ACTION).toBe('action');
      expect(AgentPhase.EVALUATE).toBe('evaluate');
    });
  });

  describe('Streaming Types', () => {
    it('should create valid StreamEvent', () => {
      const event: StreamEvent = {
        type: 'agent_start',
        data: { agent: 'plan' },
        timestamp: Date.now(),
      };
      
      expect(event.type).toBe('agent_start');
      expect(event.data.agent).toBe('plan');
      expect(typeof event.timestamp).toBe('number');
    });
  });

  describe('Command Types', () => {
    it('should create valid CommandResult', () => {
      const result: CommandResult = {
        success: true,
        output: 'command output',
        exitCode: 0,
        duration: 100,
      };
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('command output');
      expect(result.exitCode).toBe(0);
      expect(result.duration).toBe(100);
    });
  });
});
