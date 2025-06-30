/**
 * Agent State Management
 */

export enum TaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum AgentPhase {
  PLAN = 'plan',
  ACTION = 'action',
  EVALUATE = 'evaluate'
}

export enum DecisionType {
  CONTINUE_PLAN = 'CONTINUE_PLAN',
  REVISE_PLAN = 'REVISE_PLAN',
  TASK_COMPLETE = 'TASK_COMPLETE',
  TASK_FAILED = 'TASK_FAILED',
  CLARIFY_USER = 'CLARIFY_USER',
  VERIFY_ACTION = 'VERIFY_ACTION'
}

export interface AgentSummary {
  content: string;
  timestamp: Date;
  phase: AgentPhase;
}

export interface StateSnapshot {
  taskState: TaskState;
  timestamp: Date;
  iteration: number;
}

/**
 * Current state of task execution through Plan-Act-Evaluate loop
 */
export class TaskState {
  public currentPlan: string = '';
  public currentInstruction: string = '';
  public planArray: string[] = [];
  public stepIndex: number = 0;
  public lastActionTaken: string = '';
  public lastActionResult: string = '';
  public userClarification: string = '';
  public lastEvalDecision: string = '';
  public iteration: number = 0;
  public status: TaskStatus = TaskStatus.IN_PROGRESS;

  public plannerSummary: string = '';
  public actorSummary: string = '';
  public evaluatorSummary: string = '';

  public plannerRetryCount: number = 0;
  public actionRetryCount: number = 0;
  public evalRetryCount: number = 0;

  public originalPrompt: string = '';
  public executionHistory: string[] = [];
  public agentSummaries: AgentSummary[] = [];

  private stateSnapshots: StateSnapshot[] = [];
  private maxSnapshots: number = 50;

  constructor(originalPrompt?: string) {
    if (originalPrompt) {
      this.originalPrompt = originalPrompt;
    }
  }

  public resetForNewPlan(): void {
    this.currentPlan = '';
    this.currentInstruction = '';
    this.planArray = [];
    this.stepIndex = 0;
    this.userClarification = '';
    this.lastEvalDecision = '';
    this.plannerSummary = '';
    this.plannerRetryCount = 0;
  }

  public resetForPlanRevision(): void {
    this.currentPlan = '';
    this.currentInstruction = '';
    this.planArray = [];
    this.userClarification = '';
    this.plannerRetryCount = 0;
  }

  public incrementIteration(): void {
    this.iteration++;
  }

  public updatePlan(plan: string): boolean {
    if (!plan?.trim()) return false;
    this.currentPlan = plan.trim();
    this.planArray = plan.split('\n').filter(line => line.trim());
    return true;
  }

  public updateInstruction(instruction: string): boolean {
    if (!instruction?.trim()) return false;
    this.currentInstruction = instruction.trim();
    return true;
  }

  public updateActionResult(action: string, result: string): void {
    this.lastActionTaken = action;
    this.lastActionResult = result;
  }

  public incrementPlannerRetry(): number {
    return ++this.plannerRetryCount;
  }

  public incrementActionRetry(): number {
    return ++this.actionRetryCount;
  }

  public incrementEvalRetry(): number {
    return ++this.evalRetryCount;
  }

  public resetRetryCounters(): void {
    this.plannerRetryCount = 0;
    this.actionRetryCount = 0;
    this.evalRetryCount = 0;
  }

  public hasValidPlan(): boolean {
    return !!this.currentPlan?.trim();
  }

  public hasValidInstruction(): boolean {
    return !!this.currentInstruction?.trim();
  }

  public isComplete(): boolean {
    return this.status === TaskStatus.COMPLETED;
  }

  public hasFailed(): boolean {
    return this.status === TaskStatus.FAILED;
  }

  public isInProgress(): boolean {
    return this.status === TaskStatus.IN_PROGRESS;
  }

  public markComplete(): void {
    this.status = TaskStatus.COMPLETED;
  }

  public markFailed(): void {
    this.status = TaskStatus.FAILED;
  }

  public markCancelled(): void {
    this.status = TaskStatus.CANCELLED;
  }

  public addAgentSummary(content: string, phase: AgentPhase): void {
    this.agentSummaries.push({
      content,
      timestamp: new Date(),
      phase
    });
    
    if (this.agentSummaries.length > 100) {
      this.agentSummaries.shift();
    }
  }

  public addHistoryEntry(entry: string): void {
    this.executionHistory.push(`[${new Date().toISOString()}] ${entry}`);
  }

  public getRecentSummaries(count: number = 5): AgentSummary[] {
    return this.agentSummaries.slice(-count);
  }

  public createSnapshot(): void {
    const snapshot: StateSnapshot = {
      taskState: this.clone(),
      timestamp: new Date(),
      iteration: this.iteration
    };

    this.stateSnapshots.push(snapshot);
    if (this.stateSnapshots.length > this.maxSnapshots) {
      this.stateSnapshots.shift();
    }
  }

  public getSnapshot(iteration: number): StateSnapshot | null {
    return this.stateSnapshots.find(s => s.iteration === iteration) || null;
  }

  public needsNewPlan(): boolean {
    return !this.currentPlan || 
           this.lastEvalDecision === 'REVISE_PLAN' ||
           (!!this.userClarification && 
            ['CLARIFY_USER', 'PLANNER_CLARIFY'].includes(this.lastEvalDecision));
  }

  public clone(): TaskState {
    const cloned = new TaskState(this.originalPrompt);
    
    cloned.currentPlan = this.currentPlan;
    cloned.currentInstruction = this.currentInstruction;
    cloned.planArray = [...this.planArray];
    cloned.stepIndex = this.stepIndex;
    cloned.lastActionTaken = this.lastActionTaken;
    cloned.lastActionResult = this.lastActionResult;
    cloned.userClarification = this.userClarification;
    cloned.lastEvalDecision = this.lastEvalDecision;
    cloned.iteration = this.iteration;
    cloned.status = this.status;
    cloned.plannerSummary = this.plannerSummary;
    cloned.actorSummary = this.actorSummary;
    cloned.evaluatorSummary = this.evaluatorSummary;
    cloned.plannerRetryCount = this.plannerRetryCount;
    cloned.actionRetryCount = this.actionRetryCount;
    cloned.evalRetryCount = this.evalRetryCount;
    cloned.executionHistory = [...this.executionHistory];
    cloned.agentSummaries = [...this.agentSummaries];
    
    return cloned;
  }

  public serialize(): string {
    return JSON.stringify({
      currentPlan: this.currentPlan,
      currentInstruction: this.currentInstruction,
      planArray: this.planArray,
      stepIndex: this.stepIndex,
      lastActionTaken: this.lastActionTaken,
      lastActionResult: this.lastActionResult,
      userClarification: this.userClarification,
      lastEvalDecision: this.lastEvalDecision,
      iteration: this.iteration,
      status: this.status,
      plannerSummary: this.plannerSummary,
      actorSummary: this.actorSummary,
      evaluatorSummary: this.evaluatorSummary,
      plannerRetryCount: this.plannerRetryCount,
      actionRetryCount: this.actionRetryCount,
      evalRetryCount: this.evalRetryCount,
      originalPrompt: this.originalPrompt,
      executionHistory: this.executionHistory
    });
  }

  public static deserialize(json: string): TaskState {
    const data = JSON.parse(json);
    const state = new TaskState(data.originalPrompt);
    
    Object.assign(state, data);
    return state;
  }

  public clear(): void {
    this.currentPlan = '';
    this.currentInstruction = '';
    this.planArray = [];
    this.stepIndex = 0;
    this.lastActionTaken = '';
    this.lastActionResult = '';
    this.userClarification = '';
    this.lastEvalDecision = '';
    this.iteration = 0;
    this.status = TaskStatus.IN_PROGRESS;
    this.plannerSummary = '';
    this.actorSummary = '';
    this.evaluatorSummary = '';
    this.resetRetryCounters();
    this.executionHistory = [];
    this.agentSummaries = [];
    this.stateSnapshots = [];
  }

  public getSummary(): string {
    return `TaskState(iteration=${this.iteration}, status=${this.status}, ` +
           `plan=${!!this.currentPlan}, instruction=${!!this.currentInstruction}, ` +
           `retries=P:${this.plannerRetryCount}/A:${this.actionRetryCount}/E:${this.evalRetryCount})`;
  }
}

/**
 * Factory function to create initial task state
 */
export function createTaskState(originalPrompt: string): TaskState {
  return new TaskState(originalPrompt);
}

/**
 * Utility functions for state management
 */
export class StateManager {
  private static instances = new Map<string, TaskState>();

  public static getState(sessionId: string, originalPrompt?: string): TaskState {
    if (!this.instances.has(sessionId)) {
      this.instances.set(sessionId, new TaskState(originalPrompt));
    }
    return this.instances.get(sessionId)!;
  }

  public static clearState(sessionId: string): void {
    this.instances.delete(sessionId);
  }

  public static clearAllStates(): void {
    this.instances.clear();
  }

  public static getActiveSessionCount(): number {
    return this.instances.size;
  }
}

/**
 * Utility functions for state management
 */
export const StateUtils = {
  buildRetryContext(phase: AgentPhase, retryCount: number, originalContext: string): string {
    const phaseLabel = phase.toUpperCase();
    
    if (retryCount === 1) {
      return `${originalContext}\n\nIMPORTANT: Your previous ${phaseLabel} response was incomplete. Please provide a complete and properly formatted response.`;
    } else if (retryCount <= 3) {
      return `${originalContext}\n\nCRITICAL (Retry ${retryCount}): Your previous ${phaseLabel} attempts failed. You MUST provide the required format exactly.`;
    } else {
      return `${originalContext}\n\nURGENT (Retry ${retryCount}): Multiple ${phaseLabel} attempts have failed. This is your final attempt - provide exactly what is required.`;
    }
  },

  isRetryLimitExceeded(phase: AgentPhase, retryCount: number): boolean {
    const limits = {
      [AgentPhase.PLAN]: 10,
      [AgentPhase.ACTION]: 5,
      [AgentPhase.EVALUATE]: 5
    };
    
    return retryCount >= limits[phase];
  },

  getPhaseErrorMessage(phase: AgentPhase): string {
    switch (phase) {
      case AgentPhase.PLAN:
        return 'Planning phase failed after maximum retries';
      case AgentPhase.ACTION:
        return 'Action phase failed after maximum retries';
      case AgentPhase.EVALUATE:
        return 'Evaluation phase failed after maximum retries';
      default:
        return 'Unknown phase failed';
    }
  },

  isValidTransition(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.IN_PROGRESS]: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED],
      [TaskStatus.COMPLETED]: [],
      [TaskStatus.FAILED]: [],
      [TaskStatus.CANCELLED]: []
    };

    return validTransitions[fromStatus]?.includes(toStatus) ?? false;
  }
};
