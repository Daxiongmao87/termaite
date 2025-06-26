import { describe, it, expect } from 'vitest';
import { CoreApplication } from './core-application.js';
import { BaseAgent } from './agents/base-agent.js';
import { TaskStatus, AgentPhase } from './types/index.js';

describe('Core Package', () => {
  describe('CoreApplication', () => {
    it('should create an instance', () => {
      const app = new CoreApplication();
      expect(app).toBeInstanceOf(CoreApplication);
      expect(app.isReady()).toBe(false);
    });

    it('should have correct initial state', () => {
      const app = new CoreApplication({ debug: true });
      expect(app.getConfig()).toBeNull();
      expect(app.isReady()).toBe(false);
    });
  });

  describe('BaseAgent', () => {
    it('should create an agent with name', () => {
      const agent = new BaseAgent('test-agent');
      expect(agent.getName()).toBe('test-agent');
    });
  });

  describe('Types', () => {
    it('should have correct TaskStatus enum values', () => {
      expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(TaskStatus.COMPLETED).toBe('COMPLETED');
      expect(TaskStatus.FAILED).toBe('FAILED');
      expect(TaskStatus.CANCELLED).toBe('CANCELLED');
    });

    it('should have correct AgentPhase enum values', () => {
      expect(AgentPhase.PLAN).toBe('plan');
      expect(AgentPhase.ACTION).toBe('action');
      expect(AgentPhase.EVALUATE).toBe('evaluate');
    });
  });
});
