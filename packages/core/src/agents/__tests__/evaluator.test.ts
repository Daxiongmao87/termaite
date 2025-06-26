/**
 * Evaluation Agent Tests
 * Comprehensive test coverage for the Evaluation Agent implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluationAgent } from '../evaluator.js';
import type { LLMClient, CoreConfig } from '../../types/index.js';

// Mock LLM Client for testing
const mockLLMClient: LLMClient = {
  async *stream(prompt: string) {
    yield { text: '<think>Evaluating the action result</think>', done: false };
    yield { text: '\n<decision>CONTINUE_PLAN: Action completed successfully, proceeding to next step</decision>', done: true };
  },
  
  async generate(prompt: string) {
    return {
      text: '<think>Evaluating</think>\n<decision>CONTINUE_PLAN: Proceed</decision>',
      usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      model: 'test-model',
      finishReason: 'stop'
    };
  },
  
  getContextLimit: () => 4096,
};

// Mock configuration
const mockConfig: CoreConfig = {
  llm: {
    endpoint: 'http://localhost:11434',
    model: 'llama3',
    contextLimit: 4096,
    timeout: 30000,
    apiKey: undefined
  },
  agents: {
    retryLimits: {
      planner: 3,
      action: 2,
      evaluator: 2
    }
  },
  commands: {
    timeout: 30000,
    allowedCommands: { ls: 'ls', pwd: 'pwd', echo: 'echo' },
    blacklistedCommands: ['rm', 'sudo', 'dd']
  },
  context: {
    maxTokens: 4096,
    compactThreshold: 2048
  },
  ui: {
    streaming: true
  }
};

// Test evaluation context
const mockEvaluationContext = {
  originalRequest: 'List files in current directory',
  currentPlan: '- Step 1: Run ls command\n- Step 2: Show results',
  currentInstruction: 'Execute ls command',
  lastActionTaken: 'Executed command: ls',
  lastActionResult: 'Exit Code: 0. Output:\nfile1.txt\nfile2.txt\ndir1/'
};

describe('EvaluationAgent', () => {
  let agent: EvaluationAgent;

  beforeEach(() => {
    agent = new EvaluationAgent(mockLLMClient, mockConfig);
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(agent.getName()).toBe('evaluator');
      expect(agent.getType()).toBe('evaluation');
      expect(agent.canEvaluateActions()).toBe(true);
    });

    it('should set max retries from config', () => {
      const config = { ...mockConfig };
      config.agents.retryLimits.evaluator = 5;
      const testAgent = new EvaluationAgent(mockLLMClient, config);
      // Test will verify through retry behavior
      expect(testAgent).toBeDefined();
    });
  });

  describe('Input Validation', () => {
    it('should validate correct JSON input', async () => {
      const validInput = JSON.stringify(mockEvaluationContext);
      const isValid = await agent.validateInput(validInput);
      expect(isValid).toBe(true);
    });

    it('should reject invalid JSON input', async () => {
      const invalidInput = 'not valid json';
      const isValid = await agent.validateInput(invalidInput);
      expect(isValid).toBe(false);
    });

    it('should reject JSON without required fields', async () => {
      const incompleteInput = JSON.stringify({ originalRequest: 'test' });
      const isValid = await agent.validateInput(incompleteInput);
      expect(isValid).toBe(false);
    });
  });

  describe('Basic Processing', () => {
    it('should process evaluation request successfully', async () => {
      const input = JSON.stringify(mockEvaluationContext);
      const response = await agent.process(input);
      
      expect(response.status).toBe('success');
      expect(response.agentType).toBe('evaluation');
      expect(response.decisionType).toBe('CONTINUE_PLAN');
      expect(response.message).toContain('Action completed successfully');
    });

    it('should handle plain string input as fallback', async () => {
      const input = 'Simple evaluation request';
      const response = await agent.process(input);
      
      expect(response.agentType).toBe('evaluation');
      expect(response.id).toMatch(/eval-\d+/);
      expect(response.timestamp).toBeGreaterThan(0);
    });

    it('should emit streaming events during processing', async () => {
      const streamEvents: any[] = [];
      agent.on('stream', (event) => streamEvents.push(event));

      const input = JSON.stringify(mockEvaluationContext);
      await agent.process(input);

      expect(streamEvents.length).toBeGreaterThan(0);
      expect(streamEvents[0]).toHaveProperty('type');
      expect(streamEvents[0]).toHaveProperty('timestamp');
    });
  });

  describe('Decision Processing', () => {
    it('should handle TASK_COMPLETE decision', async () => {
      const completeClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>TASK_COMPLETE: All objectives achieved</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(completeClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.decisionType).toBe('TASK_COMPLETE');
      expect(response.message).toBe('All objectives achieved');
      expect(response.nextContext).toBeUndefined();
    });

    it('should handle TASK_FAILED decision', async () => {
      const failedClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>TASK_FAILED: Cannot complete task due to error</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(failedClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.decisionType).toBe('TASK_FAILED');
      expect(response.message).toBe('Cannot complete task due to error');
    });

    it('should handle REVISE_PLAN decision', async () => {
      const reviseClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>REVISE_PLAN: Need to adjust approach based on results</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(reviseClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.decisionType).toBe('REVISE_PLAN');
      expect(response.nextContext).toContain('Evaluator suggests revision');
      expect(response.nextContext).toContain('Need to adjust approach');
    });

    it('should handle CLARIFY_USER decision', async () => {
      const clarifyClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>CLARIFY_USER: Which directory should I list?</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(clarifyClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.decisionType).toBe('CLARIFY_USER');
      expect(response.requiresUserInput).toBe(true);
      expect(response.nextContext).toContain('evaluator needs clarification');
    });

    it('should handle VERIFY_ACTION decision', async () => {
      const verifyClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>VERIFY_ACTION: ls -la</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(verifyClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.decisionType).toBe('VERIFY_ACTION');
      expect(response.nextContext).toContain('Execute this command to verify');
      expect(response.nextContext).toContain('ls -la');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on invalid decision response', async () => {
      let attempts = 0;
      const retryClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          attempts++;
          if (attempts === 1) {
            yield { text: 'Invalid response without decision tags', done: true };
          } else {
            yield { text: '<decision>CONTINUE_PLAN: Success on retry</decision>', done: true };
          }
        },
      };

      const testAgent = new EvaluationAgent(retryClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(attempts).toBe(2);
      expect(response.decisionType).toBe('CONTINUE_PLAN');
    });

    it('should fail after max retries exceeded', async () => {
      const alwaysFailClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: 'No decision provided', done: true };
        },
      };

      const testAgent = new EvaluationAgent(alwaysFailClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.status).toBe('error');
      expect(response.error).toContain('failed after');
      expect(response.decisionType).toBe('TASK_FAILED');
    });

    it('should handle streaming errors gracefully', async () => {
      const errorClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          throw new Error('Stream error');
        },
      };

      const testAgent = new EvaluationAgent(errorClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.status).toBe('error');
      expect(response.error).toContain('Evaluation failed');
    });
  });

  describe('Decision Type Validation', () => {
    it('should validate all supported decision types', () => {
      const validTypes = agent.getValidDecisionTypes();
      const expectedTypes = [
        'TASK_COMPLETE',
        'TASK_FAILED',
        'CONTINUE_PLAN',
        'REVISE_PLAN',
        'CLARIFY_USER',
        'VERIFY_ACTION'
      ];

      expect(validTypes).toEqual(expectedTypes);
    });

    it('should reject invalid decision types', async () => {
      const invalidDecisionClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>INVALID_TYPE: This is not valid</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(invalidDecisionClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.status).toBe('error');
      expect(response.error).toContain('Invalid decision type');
    });
  });

  describe('Context Building', () => {
    it('should build proper evaluation prompt', async () => {
      const input = JSON.stringify({
        ...mockEvaluationContext,
        userClarification: 'List all files'
      });
      
      // Intercept the prompt by mocking the LLM client
      let capturedPrompt = '';
      const promptCapturingClient: LLMClient = {
        ...mockLLMClient,
        async *stream(prompt: string) {
          capturedPrompt = prompt;
          yield { text: '<decision>CONTINUE_PLAN: Proceed</decision>', done: true };
        },
      };

      const testAgent = new EvaluationAgent(promptCapturingClient, mockConfig);
      await testAgent.process(input);

      expect(capturedPrompt).toContain('Original User Request');
      expect(capturedPrompt).toContain('Current Plan Checklist');
      expect(capturedPrompt).toContain('Instruction that was attempted');
      expect(capturedPrompt).toContain('Action Taken by Actor');
      expect(capturedPrompt).toContain('Result of Action');
      expect(capturedPrompt).toContain('User responded \'List all files\'');
      expect(capturedPrompt).toContain('REQUIRED OUTPUT FORMAT');
    });

    it('should build different next contexts based on decision type', async () => {
      const testCases = [
        { decisionType: 'CONTINUE_PLAN', expectedContext: 'Provide next instruction' },
        { decisionType: 'REVISE_PLAN', expectedContext: 'Revise checklist' },
        { decisionType: 'CLARIFY_USER', expectedContext: 'evaluator needs clarification' },
        { decisionType: 'VERIFY_ACTION', expectedContext: 'Execute this command to verify' }
      ];

      for (const testCase of testCases) {
        const testClient: LLMClient = {
          ...mockLLMClient,
          async *stream() {
            yield { text: `<decision>${testCase.decisionType}: Test message</decision>`, done: true };
          },
        };

        const testAgent = new EvaluationAgent(testClient, mockConfig);
        const input = JSON.stringify(mockEvaluationContext);
        const response = await testAgent.process(input);

        expect(response.nextContext).toContain(testCase.expectedContext);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM client errors', async () => {
      const errorClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          throw new Error('LLM service unavailable');
        },
      };

      const testAgent = new EvaluationAgent(errorClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.status).toBe('error');
      expect(response.error).toContain('Evaluation failed');
    });

    it('should handle malformed responses', async () => {
      const malformedClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: 'Completely malformed response with no structure', done: true };
        },
      };

      const testAgent = new EvaluationAgent(malformedClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.status).toBe('error');
      expect(response.error).toContain('No decision found');
    });
  });

  describe('Integration Features', () => {
    it('should extract thoughts and summaries from response', async () => {
      const detailedClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { 
            text: '<think>Analyzing the command output carefully</think>\n<decision>CONTINUE_PLAN: Good results</decision>\n<summary>Command executed successfully</summary>', 
            done: true 
          };
        },
      };

      const testAgent = new EvaluationAgent(detailedClient, mockConfig);
      const input = JSON.stringify(mockEvaluationContext);
      const response = await testAgent.process(input);

      expect(response.content).toContain('Analyzing the command output');
      expect(response.decisionType).toBe('CONTINUE_PLAN');
    });

    it('should handle user clarification context', async () => {
      const contextWithClarification = {
        ...mockEvaluationContext,
        userClarification: 'Show hidden files too'
      };

      const input = JSON.stringify(contextWithClarification);
      const response = await agent.process(input);

      expect(response.status).toBe('success');
      // The prompt should include the clarification in context building
    });

    it('should set proper response timestamps and IDs', async () => {
      const input = JSON.stringify(mockEvaluationContext);
      const response = await agent.process(input);

      expect(response.id).toMatch(/eval-\d+/);
      expect(response.timestamp).toBeGreaterThan(Date.now() - 1000);
      expect(response.agentType).toBe('evaluation');
    });
  });
});
