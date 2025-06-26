/**
 * Plan Agent Tests
 * Comprehensive test coverage for the Plan Agent implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanAgent } from '../planner.js';
import type { LLMClient, CoreConfig } from '../../types/index.js';

// Mock LLM Client for testing
const mockLLMClient: LLMClient = {
  async *stream(prompt: string) {
    yield { text: '<think>Planning the task step by step</think>', done: false };
    yield { text: '\n<checklist>\n1. List files in current directory\n2. Show the results\n</checklist>', done: false };
    yield { text: '\n<instruction>Execute the ls command to list files</instruction>', done: true };
  },
  
  async generate(prompt: string) {
    return {
      text: '<think>Planning</think>\n<checklist>\n1. List files\n</checklist>\n<instruction>Execute ls</instruction>',
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
    allowedCommands: { ls: 'ls', pwd: 'pwd' },
    blacklistedCommands: ['rm', 'sudo']
  },
  context: {
    maxTokens: 2048,
    compactThreshold: 1024
  },
  ui: {
    streaming: true
  }
};

describe('PlanAgent', () => {
  let planAgent: PlanAgent;

  beforeEach(() => {
    planAgent = new PlanAgent(mockLLMClient, mockConfig);
  });

  describe('Basic Functionality', () => {
    it('should create a plan agent with correct properties', () => {
      expect(planAgent.getName()).toBe('planner');
      expect(planAgent.getType()).toBe('plan');
      expect(planAgent.getMaxRetries()).toBe(3);
      expect(planAgent.getRetryCount()).toBe(0);
    });

    it('should validate input correctly', async () => {
      expect(await planAgent.validateInput('list files')).toBe(true);
      expect(await planAgent.validateInput('')).toBe(false);
      expect(await planAgent.validateInput('   ')).toBe(false);
      expect(await planAgent.validateInput('a'.repeat(10001))).toBe(false); // Too long
    });
  });

  describe('Plan Generation', () => {
    it('should generate a plan for a simple request', async () => {
      const response = await planAgent.process('list files in current directory');
      
      expect(response.status).toBe('success');
      expect(response.agentType).toBe('plan');
      expect(response.content).toContain('<checklist>');
      expect(response.content).toContain('<instruction>');
      expect(response.data).toBeDefined();
      expect(response.data.plan).toContain('List files');
      expect(response.data.instruction).toContain('ls');
    });

    it('should handle clarification requests', async () => {
      const clarificationMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: '<think>Need clarification</think>', done: false };
          yield { text: '\n<decision>CLARIFY_USER: Which directory do you want to list?</decision>', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new PlanAgent(clarificationMockClient, mockConfig);
      const response = await agent.process('list files');

      expect(response.status).toBe('success');
      expect(response.data.decision).toContain('CLARIFY_USER:');
    });

    it('should extract plan items correctly', () => {
      const plan = '1. First step\n2. Second step\n3. Third step';
      const items = planAgent.getPlanItems(plan);
      
      expect(items).toEqual(['First step', 'Second step', 'Third step']);
    });

    it('should handle different plan formats', () => {
      const bulletPlan = '- First step\n- Second step\n* Third step';
      const items = planAgent.getPlanItems(bulletPlan);
      
      expect(items).toEqual(['First step', 'Second step', 'Third step']);
    });
  });

  describe('Retry Logic', () => {
    it('should retry when plan is incomplete', async () => {
      let callCount = 0;
      const incompleteMockClient: LLMClient = {
        async *stream(prompt: string) {
          callCount++;
          if (callCount === 1) {
            // First attempt - missing instruction
            yield { text: '<think>Planning</think>', done: false };
            yield { text: '\n<checklist>\n1. Do something\n</checklist>', done: true };
          } else {
            // Second attempt - complete
            yield { text: '<think>Planning again</think>', done: false };
            yield { text: '\n<checklist>\n1. List files\n</checklist>', done: false };
            yield { text: '\n<instruction>Execute ls command</instruction>', done: true };
          }
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new PlanAgent(incompleteMockClient, mockConfig);
      const response = await agent.process('list files');

      expect(callCount).toBe(2); // Should have retried once
      expect(response.status).toBe('success');
      expect(response.data.plan).toBeDefined();
      expect(response.data.instruction).toBeDefined();
    });

    it('should fail after max retries', async () => {
      const failingMockClient: LLMClient = {
        async *stream(prompt: string) {
          // Always return incomplete response
          yield { text: '<think>Planning</think>', done: false };
          yield { text: '\n<checklist>\n1. Do something\n</checklist>', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new PlanAgent(failingMockClient, mockConfig);
      
      const response = await agent.process('list files');
      expect(response.status).toBe('error');
      expect(response.error).toContain('failed after');
    });

    it('should reset retry count', () => {
      planAgent.getRetryCount(); // Access private state through public method
      planAgent.resetRetryCount();
      expect(planAgent.getRetryCount()).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit chunk events during streaming', async () => {
      const chunks: any[] = [];
      planAgent.on('chunk', (chunk) => chunks.push(chunk));

      await planAgent.process('list files');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('type', 'plan');
      expect(chunks[0]).toHaveProperty('agentId', 'planner');
    });

    it('should emit agent lifecycle events', async () => {
      const events: any[] = [];
      planAgent.on('agentStart', (event) => events.push({ type: 'start', event }));
      planAgent.on('agentComplete', (event) => events.push({ type: 'complete', event }));

      await planAgent.process('list files');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('complete');
    });
  });

  describe('Error Handling', () => {
    it('should handle LLM client errors gracefully', async () => {
      const errorMockClient: LLMClient = {
        async *stream(prompt: string) {
          throw new Error('LLM connection failed');
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new PlanAgent(errorMockClient, mockConfig);
      const response = await agent.process('list files');

      expect(response.status).toBe('error');
      expect(response.error).toContain('LLM connection failed');
    });

    it('should handle malformed responses', async () => {
      const malformedMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: 'This is not a valid XML response', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new PlanAgent(malformedMockClient, mockConfig);
      const response = await agent.process('list files');

      // Should retry and eventually fail
      expect(response.status).toBe('error');
    });
  });

  describe('Agent State Management', () => {
    it('should not be processing initially', () => {
      expect(planAgent.isActive()).toBe(false);
    });

    it('should have correct agent properties', () => {
      expect(planAgent.getName()).toBe('planner');
      expect(planAgent.getType()).toBe('plan');
    });

    it('should destroy cleanly', () => {
      expect(() => planAgent.destroy()).not.toThrow();
      expect(planAgent.isActive()).toBe(false);
    });
  });
});
