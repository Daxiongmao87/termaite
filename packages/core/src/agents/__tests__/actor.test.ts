/**
 * Action Agent Tests
 * Comprehensive test coverage for the Action Agent implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionAgent } from '../actor.js';
import type { LLMClient, CoreConfig, CommandResult } from '../../types/index.js';

// Mock LLM Client for testing
const mockLLMClient: LLMClient = {
  async *stream(prompt: string) {
    yield { text: '<think>I need to execute the ls command</think>', done: false };
    yield { text: '\n```agent_command\nls -la\n```', done: false };
    yield { text: '\n<summary>Listed directory contents</summary>', done: true };
  },
  
  async generate(prompt: string) {
    return {
      text: '<think>Executing</think>\n```agent_command\nls\n```\n<summary>Listed files</summary>',
      usage: { promptTokens: 40, completionTokens: 25, totalTokens: 65 },
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
    maxTokens: 2048,
    compactThreshold: 1024
  },
  ui: {
    streaming: true
  }
};

describe('ActionAgent', () => {
  let actionAgent: ActionAgent;

  beforeEach(() => {
    actionAgent = new ActionAgent(mockLLMClient, mockConfig);
  });

  describe('Basic Functionality', () => {
    it('should create an action agent with correct properties', () => {
      expect(actionAgent.getName()).toBe('actor');
      expect(actionAgent.getType()).toBe('action');
      expect(actionAgent.getMaxRetries()).toBe(2);
      expect(actionAgent.getRetryCount()).toBe(0);
    });

    it('should validate input correctly', async () => {
      expect(await actionAgent.validateInput('execute ls command')).toBe(true);
      expect(await actionAgent.validateInput('')).toBe(false);
      expect(await actionAgent.validateInput('   ')).toBe(false);
      expect(await actionAgent.validateInput('a'.repeat(10001))).toBe(false);
    });

    it('should check if it can execute commands', () => {
      expect(actionAgent.canExecuteCommands()).toBe(true);
    });
  });

  describe('Command Execution', () => {
    it('should process a command suggestion in normal mode', async () => {
      const response = await actionAgent.process('Execute the ls command to list files');
      
      expect(response.status).toBe('success');
      expect(response.agentType).toBe('action');
      expect(response.data.command).toBe('ls -la');
      expect(response.data.requiresConfirmation).toBe(true);
      expect(response.data.actionTaken).toContain('Command ready for execution');
    });

    it('should handle task completion signal', async () => {
      const completionMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: '<think>Task is complete</think>', done: false };
          yield { text: '\n```agent_command\nreport_task_completion\n```', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(completionMockClient, mockConfig);
      const response = await agent.process('Check if task is complete');

      expect(response.status).toBe('success');
      expect(response.data.command).toBe('report_task_completion');
      expect(response.data.actionTaken).toBe('Internal signal: report_task_completion');
      expect(response.data.requiresConfirmation).toBe(false);
    });

    it('should handle text responses without commands', async () => {
      const textMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: '<think>Need more information</think>', done: false };
          yield { text: '\nI need more information about which directory to list.', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(textMockClient, mockConfig);
      const response = await agent.process('List something');

      expect(response.status).toBe('success');
      expect(response.data.actionTaken).toBe('Actor provided text response');
      expect(response.data.actionResult).toContain('need more information');
    });

    it('should block blacklisted commands', async () => {
      const dangerousMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: '<think>Executing dangerous command</think>', done: false };
          yield { text: '\n```agent_command\nrm -rf /\n```', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(dangerousMockClient, mockConfig);
      const response = await agent.process('Delete everything');

      expect(response.status).toBe('success');
      expect(response.data.actionTaken).toContain('not executed');
      expect(response.data.actionResult).toContain('blacklisted');
    });
  });

  describe('Command Permission Checking', () => {
    it('should allow commands in allowed list', async () => {
      // This is tested indirectly through the main process method
      const response = await actionAgent.process('Run ls command');
      expect(response.data.requiresConfirmation).toBe(true); // Means it passed permission check
    });

    it('should block commands not in allowed list', async () => {
      const unauthorizedMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: '<think>Running unauthorized command</think>', done: false };
          yield { text: '\n```agent_command\nunauthorized_command\n```', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(unauthorizedMockClient, mockConfig);
      const response = await agent.process('Run unauthorized command');

      expect(response.data.actionResult).toContain('not in allowed list');
    });
  });

  describe('Command Execution with Mock', () => {
    it('should execute commands and return results', async () => {
      // Mock the executeCommand method for testing
      const originalExecuteCommand = (actionAgent as any).executeCommand;
      const mockResult: CommandResult = {
        success: true,
        output: 'file1.txt\nfile2.txt',
        exitCode: 0,
        duration: 100
      };

      (actionAgent as any).executeCommand = vi.fn().mockResolvedValue(mockResult);

      // Test in goblin mode (auto-execute)
      actionAgent.setContext({
        sessionId: 'test',
        config: { operationMode: 'goblin' } as any,
        task: 'test',
        mode: 'goblin',
        environment: {
          workingDirectory: '/test',
          platform: 'linux',
          nodeVersion: '18.0.0'
        }
      });

      const response = await actionAgent.process('List files');

      expect(response.data.commandResult).toEqual(mockResult);
      expect(response.data.actionTaken).toContain('Executed command');

      // Restore original method
      (actionAgent as any).executeCommand = originalExecuteCommand;
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

      const agent = new ActionAgent(errorMockClient, mockConfig);
      const response = await agent.process('Execute something');

      expect(response.status).toBe('error');
      expect(response.error).toContain('LLM connection failed');
    });

    it('should handle empty responses', async () => {
      const emptyMockClient: LLMClient = {
        async *stream(prompt: string) {
          yield { text: '<think>No action needed</think>', done: true };
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(emptyMockClient, mockConfig);
      const response = await agent.process('Do nothing');

      expect(response.status).toBe('success');
      expect(response.data.actionTaken).toBe('Actor: no command and no question');
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed operations', async () => {
      let callCount = 0;
      const retryMockClient: LLMClient = {
        async *stream(prompt: string) {
          callCount++;
          if (callCount === 1) {
            throw new Error('Temporary failure');
          } else {
            yield { text: '<think>Success on retry</think>', done: false };
            yield { text: '\n```agent_command\necho "success"\n```', done: true };
          }
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(retryMockClient, mockConfig);
      const response = await agent.process('Execute echo command');

      expect(callCount).toBe(2);
      expect(response.status).toBe('success');
    });

    it('should fail after max retries', async () => {
      const failingMockClient: LLMClient = {
        async *stream(prompt: string) {
          throw new Error('Persistent failure');
        },
        generate: mockLLMClient.generate,
        getContextLimit: () => 4096,
      };

      const agent = new ActionAgent(failingMockClient, mockConfig);
      const response = await agent.process('Execute something');

      expect(response.status).toBe('error');
      expect(response.error).toContain('failed after');
    });

    it('should reset retry count', () => {
      actionAgent.resetRetryCount();
      expect(actionAgent.getRetryCount()).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit chunk events during streaming', async () => {
      const chunks: any[] = [];
      actionAgent.on('chunk', (chunk) => chunks.push(chunk));

      await actionAgent.process('List files');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toHaveProperty('type', 'action');
      expect(chunks[0]).toHaveProperty('agentId', 'actor');
    });

    it('should emit agent lifecycle events', async () => {
      const events: any[] = [];
      actionAgent.on('agentStart', (event) => events.push({ type: 'start', event }));
      actionAgent.on('agentComplete', (event) => events.push({ type: 'complete', event }));

      await actionAgent.process('List files');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('start');
      expect(events[1].type).toBe('complete');
    });
  });

  describe('Agent State Management', () => {
    it('should not be processing initially', () => {
      expect(actionAgent.isActive()).toBe(false);
    });

    it('should have correct agent properties', () => {
      expect(actionAgent.getName()).toBe('actor');
      expect(actionAgent.getType()).toBe('action');
    });

    it('should destroy cleanly', () => {
      expect(() => actionAgent.destroy()).not.toThrow();
      expect(actionAgent.isActive()).toBe(false);
    });
  });

  describe('Command Execution Method', () => {
    it('should handle executeWithConfirmation', async () => {
      const mockResult: CommandResult = {
        success: true,
        output: 'test output',
        exitCode: 0,
        duration: 50
      };

      // Mock the private executeCommand method
      (actionAgent as any).executeCommand = vi.fn().mockResolvedValue(mockResult);

      const result = await actionAgent.executeWithConfirmation('echo "test"');
      expect(result).toEqual(mockResult);
    });
  });
});
