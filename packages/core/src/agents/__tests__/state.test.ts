/**
 * Tests for Agent State Management
 */

import { describe, expect, test, beforeEach } from 'vitest';
import { 
  TaskState, 
  StateManager, 
  StateUtils,
  TaskStatus, 
  AgentPhase, 
  DecisionType 
} from '../state';

describe('TaskState', () => {
  let taskState: TaskState;

  beforeEach(() => {
    taskState = new TaskState('Test user prompt');
  });

  test('should initialize with default values', () => {
    expect(taskState.currentPlan).toBe('');
    expect(taskState.currentInstruction).toBe('');
    expect(taskState.planArray).toEqual([]);
    expect(taskState.stepIndex).toBe(0);
    expect(taskState.iteration).toBe(0);
    expect(taskState.status).toBe(TaskStatus.IN_PROGRESS);
    expect(taskState.originalPrompt).toBe('Test user prompt');
  });

  test('should reset for new plan correctly', () => {
    // Set up initial state
    taskState.currentPlan = 'Some plan';
    taskState.currentInstruction = 'Some instruction';
    taskState.planArray = ['step1', 'step2'];
    taskState.stepIndex = 1;
    taskState.userClarification = 'Some clarification';
    taskState.plannerSummary = 'Some summary';
    taskState.plannerRetryCount = 3;

    taskState.resetForNewPlan();

    expect(taskState.currentPlan).toBe('');
    expect(taskState.currentInstruction).toBe('');
    expect(taskState.planArray).toEqual([]);
    expect(taskState.stepIndex).toBe(0);
    expect(taskState.userClarification).toBe('');
    expect(taskState.plannerSummary).toBe('');
    expect(taskState.plannerRetryCount).toBe(0);
  });

  test('should manage retry counters correctly', () => {
    expect(taskState.getRetryCount(AgentPhase.PLAN)).toBe(0);
    
    const newCount = taskState.incrementRetryCount(AgentPhase.PLAN);
    expect(newCount).toBe(1);
    expect(taskState.getRetryCount(AgentPhase.PLAN)).toBe(1);

    taskState.resetRetryCount(AgentPhase.PLAN);
    expect(taskState.getRetryCount(AgentPhase.PLAN)).toBe(0);
  });

  test('should manage agent summaries correctly', () => {
    const summary = 'Test planner summary';
    taskState.addAgentSummary(summary, AgentPhase.PLAN);

    expect(taskState.plannerSummary).toBe(summary);
    expect(taskState.agentSummaries).toHaveLength(1);
    expect(taskState.agentSummaries[0].content).toBe(summary);
    expect(taskState.agentSummaries[0].phase).toBe(AgentPhase.PLAN);
  });

  test('should check if new plan is needed', () => {
    // No plan
    expect(taskState.needsNewPlan()).toBe(true);

    // Has plan
    taskState.currentPlan = 'Some plan';
    expect(taskState.needsNewPlan()).toBe(false);

    // Needs revision
    taskState.lastEvalDecision = 'REVISE_PLAN';
    expect(taskState.needsNewPlan()).toBe(true);

    // Reset decision
    taskState.lastEvalDecision = '';
    expect(taskState.needsNewPlan()).toBe(false);

    // User clarification with specific decision
    taskState.userClarification = 'Some clarification';
    taskState.lastEvalDecision = 'CLARIFY_USER';
    expect(taskState.needsNewPlan()).toBe(true);
  });

  test('should create and manage snapshots', () => {
    taskState.iteration = 5;
    taskState.currentPlan = 'Test plan';
    
    taskState.createSnapshot();
    
    const snapshot = taskState.getSnapshot(5);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.iteration).toBe(5);
    expect(snapshot!.taskState.currentPlan).toBe('Test plan');

    const latest = taskState.getLatestSnapshot();
    expect(latest).toBe(snapshot);
  });

  test('should serialize and deserialize correctly', () => {
    // Set up state
    taskState.currentPlan = 'Test plan';
    taskState.iteration = 10;
    taskState.plannerRetryCount = 2;
    taskState.addAgentSummary('Test summary', AgentPhase.ACTION);

    const serialized = taskState.serialize();
    expect(serialized).toContain('Test plan');
    expect(serialized).toContain('Test summary');

    const deserialized = TaskState.deserialize(serialized);
    expect(deserialized.currentPlan).toBe('Test plan');
    expect(deserialized.iteration).toBe(10);
    expect(deserialized.plannerRetryCount).toBe(2);
    expect(deserialized.agentSummaries).toHaveLength(1);
  });

  test('should validate state correctly', () => {
    const validation = taskState.validate();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Invalid state
    taskState.iteration = -1;
    taskState.stepIndex = -1;
    taskState.plannerRetryCount = -1;

    const invalidValidation = taskState.validate();
    expect(invalidValidation.valid).toBe(false);
    expect(invalidValidation.errors.length).toBeGreaterThan(0);
  });

  test('should clone state correctly', () => {
    taskState.currentPlan = 'Original plan';
    taskState.iteration = 5;
    taskState.planArray = ['step1', 'step2'];

    const cloned = taskState.clone();
    
    expect(cloned.currentPlan).toBe(taskState.currentPlan);
    expect(cloned.iteration).toBe(taskState.iteration);
    expect(cloned.planArray).toEqual(taskState.planArray);
    
    // Ensure they are separate objects
    cloned.currentPlan = 'Modified plan';
    expect(taskState.currentPlan).toBe('Original plan');
  });
});

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager(false); // Disable persistence for tests
  });

  test('should initialize state correctly', () => {
    const state = stateManager.initializeState('Test prompt');
    
    expect(state).toBeInstanceOf(TaskState);
    expect(state.originalPrompt).toBe('Test prompt');
    expect(stateManager.getCurrentState()).toBe(state);
  });

  test('should update state correctly', () => {
    const state = stateManager.initializeState('Test prompt');
    state.iteration = 5;
    
    stateManager.updateState(state);
    
    const current = stateManager.getCurrentState();
    expect(current!.iteration).toBe(5);
  });

  test('should create checkpoints', () => {
    const state = stateManager.initializeState('Test prompt');
    state.iteration = 3;
    
    stateManager.createCheckpoint();
    
    const snapshot = state.getLatestSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot!.iteration).toBe(3);
  });

  test('should reset correctly', () => {
    stateManager.initializeState('Test prompt');
    expect(stateManager.getCurrentState()).not.toBeNull();
    
    stateManager.reset();
    expect(stateManager.getCurrentState()).toBeNull();
  });
});

describe('StateUtils', () => {
  test('should build retry context correctly', () => {
    const originalContext = 'Original context';
    
    const firstRetry = StateUtils.buildRetryContext(AgentPhase.PLAN, 1, originalContext);
    expect(firstRetry).toContain('IMPORTANT');
    expect(firstRetry).toContain('PLAN');
    
    const thirdRetry = StateUtils.buildRetryContext(AgentPhase.ACTION, 3, originalContext);
    expect(thirdRetry).toContain('CRITICAL');
    expect(thirdRetry).toContain('Retry 3');
    
    const finalRetry = StateUtils.buildRetryContext(AgentPhase.EVALUATE, 5, originalContext);
    expect(finalRetry).toContain('URGENT');
    expect(finalRetry).toContain('final attempt');
  });

  test('should check retry limits correctly', () => {
    expect(StateUtils.isRetryLimitExceeded(AgentPhase.PLAN, 5)).toBe(false);
    expect(StateUtils.isRetryLimitExceeded(AgentPhase.PLAN, 10)).toBe(true);
    
    expect(StateUtils.isRetryLimitExceeded(AgentPhase.ACTION, 3)).toBe(false);
    expect(StateUtils.isRetryLimitExceeded(AgentPhase.ACTION, 5)).toBe(true);
    
    expect(StateUtils.isRetryLimitExceeded(AgentPhase.EVALUATE, 4)).toBe(false);
    expect(StateUtils.isRetryLimitExceeded(AgentPhase.EVALUATE, 5)).toBe(true);
  });

  test('should provide phase error messages', () => {
    const planError = StateUtils.getPhaseErrorMessage(AgentPhase.PLAN);
    expect(planError).toContain('Planning phase');
    
    const actionError = StateUtils.getPhaseErrorMessage(AgentPhase.ACTION);
    expect(actionError).toContain('Action phase');
    
    const evalError = StateUtils.getPhaseErrorMessage(AgentPhase.EVALUATE);
    expect(evalError).toContain('Evaluation phase');
  });

  test('should validate state transitions', () => {
    expect(StateUtils.isValidTransition(
      TaskStatus.IN_PROGRESS, 
      TaskStatus.COMPLETED
    )).toBe(true);
    
    expect(StateUtils.isValidTransition(
      TaskStatus.IN_PROGRESS, 
      TaskStatus.FAILED
    )).toBe(true);
    
    expect(StateUtils.isValidTransition(
      TaskStatus.COMPLETED, 
      TaskStatus.IN_PROGRESS
    )).toBe(false);
    
    expect(StateUtils.isValidTransition(
      TaskStatus.FAILED, 
      TaskStatus.COMPLETED
    )).toBe(false);
  });
});

describe('Enums', () => {
  test('should have correct TaskStatus values', () => {
    expect(TaskStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(TaskStatus.COMPLETED).toBe('COMPLETED');
    expect(TaskStatus.FAILED).toBe('FAILED');
    expect(TaskStatus.CANCELLED).toBe('CANCELLED');
  });

  test('should have correct AgentPhase values', () => {
    expect(AgentPhase.PLAN).toBe('plan');
    expect(AgentPhase.ACTION).toBe('action');
    expect(AgentPhase.EVALUATE).toBe('evaluate');
  });

  test('should have correct DecisionType values', () => {
    expect(DecisionType.CONTINUE_PLAN).toBe('CONTINUE_PLAN');
    expect(DecisionType.REVISE_PLAN).toBe('REVISE_PLAN');
    expect(DecisionType.TASK_COMPLETE).toBe('TASK_COMPLETE');
    expect(DecisionType.TASK_FAILED).toBe('TASK_FAILED');
    expect(DecisionType.CLARIFY_USER).toBe('CLARIFY_USER');
    expect(DecisionType.VERIFY_ACTION).toBe('VERIFY_ACTION');
  });
});
