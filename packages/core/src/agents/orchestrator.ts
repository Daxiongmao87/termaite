/**
 * Agent Orchestrator implementation - Plan-Act-Evaluate loop coordination
 */

import { EventEmitter } from 'events';
import type { LLMClient, CoreConfig, AgentResponse } from '../types/index.js';
import { PlanAgent } from './planner.js';
import { ActionAgent } from './actor.js';
import { EvaluationAgent } from './evaluator.js';

export type EvaluationDecisionType = 'TASK_COMPLETE' | 'TASK_FAILED' | 'CONTINUE_PLAN' | 'REVISE_PLAN' | 'CLARIFY_USER' | 'VERIFY_ACTION';

export enum TaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

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
  plannerSummary: string;
  actorSummary: string;
  evaluatorSummary: string;
  plannerRetryCount: number;
  actionRetryCount: number;
  evalRetryCount: number;
}

export interface OrchestratorConfig {
  maxPlannerRetries: number;
  maxActionRetries: number;
  maxEvalRetries: number;
  allowClarifyingQuestions: boolean;
  operationMode: 'normal' | 'gremlin' | 'goblin';
}

export interface TaskResult {
  success: boolean;
  message: string;
  taskState: TaskState;
  error?: Error;
}

export class AgentOrchestrator extends EventEmitter {
  private planAgent: PlanAgent;
  private actionAgent: ActionAgent;
  private evaluationAgent: EvaluationAgent;
  private config: OrchestratorConfig;

  constructor(llmClient: LLMClient, coreConfig: CoreConfig) {
    super();
    
    this.planAgent = new PlanAgent(llmClient, coreConfig);
    this.actionAgent = new ActionAgent(llmClient, coreConfig);
    this.evaluationAgent = new EvaluationAgent(llmClient, coreConfig);
    
    this.config = {
      maxPlannerRetries: coreConfig.agents.retryLimits.planner,
      maxActionRetries: coreConfig.agents.retryLimits.action,
      maxEvalRetries: coreConfig.agents.retryLimits.evaluator,
      allowClarifyingQuestions: true,
      operationMode: 'normal'
    };

    this.setupEventForwarding();
  }

  async executeTask(userPrompt: string): Promise<TaskResult> {
    const taskState = this.createInitialTaskState();
    let taskStatus = TaskStatus.IN_PROGRESS;
    let currentContext = userPrompt;

    this.emit('taskStarted', { userPrompt, taskState });

    try {
      while (taskStatus === TaskStatus.IN_PROGRESS) {
        taskState.iteration++;
        this.emit('iterationStarted', { iteration: taskState.iteration, taskState });

        if (this.shouldPlan(taskState)) {
          taskStatus = await this.executePlanPhase(currentContext, taskState);
          if (taskStatus !== TaskStatus.IN_PROGRESS) break;
          currentContext = this.buildContext('action', userPrompt, taskState);
        }

        if (!taskState.currentInstruction) {
          taskStatus = await this.handleMissingInstruction(userPrompt, taskState);
          if (taskStatus !== TaskStatus.IN_PROGRESS) break;
          continue;
        }

        if (taskState.currentInstruction) {
          taskState.plannerRetryCount = 0;
        }

        taskStatus = await this.executeActionPhase(currentContext, taskState);
        if (taskStatus !== TaskStatus.IN_PROGRESS) break;

        const evalContext = this.buildContext('evaluation', userPrompt, taskState);
        const evalResult = await this.executeEvaluationPhase(evalContext, taskState);
        taskStatus = evalResult.status;
        currentContext = evalResult.nextContext;
      }

      const result: TaskResult = {
        success: taskStatus === TaskStatus.COMPLETED,
        message: this.getTaskResultMessage(taskStatus),
        taskState
      };

      this.emit('taskCompleted', result);
      return result;

    } catch (error) {
      const errorResult: TaskResult = {
        success: false,
        message: `Task execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        taskState,
        error: error instanceof Error ? error : new Error(String(error))
      };

      this.emit('taskError', errorResult);
      return errorResult;
    }
  }

  private async executePlanPhase(context: string, taskState: TaskState): Promise<TaskStatus> {
    try {
      const response = await this.planAgent.process(context);
      
      // Handle content from response
      const planContent = response.content;
      
      if (!planContent) {
        throw new Error('No plan content received');
      }

      this.parsePlanResponse(planContent, taskState);
      
      if (!taskState.currentInstruction) {
        taskState.plannerRetryCount++;
        if (taskState.plannerRetryCount <= this.config.maxPlannerRetries) {
          const retryContext = this.buildContext('planRetry', context, taskState);
          return this.executePlanPhase(retryContext, taskState);
        } else {
          return TaskStatus.FAILED;
        }
      }

      this.emit('planCompleted', { plan: taskState.currentPlan, instruction: taskState.currentInstruction });
      return TaskStatus.IN_PROGRESS;

    } catch (error) {
      taskState.plannerRetryCount++;
      if (taskState.plannerRetryCount <= this.config.maxPlannerRetries) {
        const retryContext = this.buildContext('planRetry', context, taskState);
        return this.executePlanPhase(retryContext, taskState);
      }
      return TaskStatus.FAILED;
    }
  }

  private async executeActionPhase(context: string, taskState: TaskState): Promise<TaskStatus> {
    try {
      const response = await this.actionAgent.process(context);
      
      const actionContent = response.content;
      
      if (!actionContent) {
        throw new Error('No action content received');
      }

      taskState.lastActionTaken = actionContent;
      taskState.lastActionResult = actionContent;
      taskState.actorSummary = response.data?.summary || '';

      this.emit('actionCompleted', { action: taskState.lastActionTaken, result: taskState.lastActionResult });
      return TaskStatus.IN_PROGRESS;

    } catch (error) {
      taskState.actionRetryCount++;
      if (taskState.actionRetryCount <= this.config.maxActionRetries) {
        return this.executeActionPhase(context, taskState);
      }
      return TaskStatus.FAILED;
    }
  }

  private async executeEvaluationPhase(context: string, taskState: TaskState): Promise<{ status: TaskStatus; nextContext: string }> {
    try {
      const response = await this.evaluationAgent.process(context);
      
      const evalContent = response.content;
      const decision = response.decision || this.parseEvaluationDecision(evalContent);
      
      taskState.lastEvalDecision = decision;
      taskState.evaluatorSummary = response.data?.summary || '';

      this.emit('evaluationCompleted', { decision, evaluation: evalContent });

      return this.handleEvaluationDecision(decision, context, taskState);

    } catch (error) {
      taskState.evalRetryCount++;
      if (taskState.evalRetryCount <= this.config.maxEvalRetries) {
        return this.executeEvaluationPhase(context, taskState);
      }
      return { status: TaskStatus.FAILED, nextContext: context };
    }
  }

  private handleEvaluationDecision(decision: string, context: string, taskState: TaskState): { status: TaskStatus; nextContext: string } {
    switch (decision as EvaluationDecisionType) {
      case 'TASK_COMPLETE':
        return { status: TaskStatus.COMPLETED, nextContext: context };
      
      case 'TASK_FAILED':
        return { status: TaskStatus.FAILED, nextContext: context };
      
      case 'CONTINUE_PLAN':
        this.resetForNextInstruction(taskState);
        return { status: TaskStatus.IN_PROGRESS, nextContext: this.buildContext('continue', '', taskState) };
      
      case 'REVISE_PLAN':
        this.resetForPlanRevision(taskState);
        return { status: TaskStatus.IN_PROGRESS, nextContext: this.buildContext('revise', '', taskState) };
      
      case 'CLARIFY_USER':
        return this.handleUserClarification(context, taskState);
      
      case 'VERIFY_ACTION':
        return this.handleActionVerification(context, taskState);
      
      default:
        return { status: TaskStatus.IN_PROGRESS, nextContext: context };
    }
  }

  private buildContext(type: 'action' | 'evaluation' | 'planRetry' | 'continue' | 'revise', prompt: string, taskState: TaskState): string {
    switch (type) {
      case 'action':
        let context = `User's original request: '${prompt}'\n\nInstruction to execute: '${taskState.currentInstruction}'`;
        if (taskState.plannerSummary) context += `\n\nPlanner's Summary: ${taskState.plannerSummary}`;
        if (taskState.userClarification) {
          context += `\n\nContext: User responded '${taskState.userClarification}' to my last question.`;
          taskState.userClarification = '';
        }
        return context;

      case 'evaluation':
        return `User's original request: '${prompt}'\n\nCurrent Plan Checklist:\n${taskState.currentPlan}\n\nInstruction that was attempted: '${taskState.currentInstruction}'\n\nAction Taken:\n${taskState.lastActionTaken}\n\nResult:\n${taskState.lastActionResult}`;

      case 'planRetry':
        return taskState.plannerRetryCount === 1 
          ? `${prompt}\n\nIMPORTANT: Your previous response did not include a proper <instruction> section. You MUST provide both a <checklist> (plan steps) AND an <instruction> (next action) in your response.`
          : `${prompt}\n\nCRITICAL (Retry ${taskState.plannerRetryCount}): You must include BOTH sections: 1. <checklist> with plan steps 2. <instruction> with specific action to take`;

      case 'continue':
        return `Continue with the next step in the plan:\n${taskState.currentPlan}\n\nCompleted step: ${taskState.currentInstruction}`;

      case 'revise':
        return `Revise the plan based on feedback:\n${taskState.lastEvalDecision}`;

      default:
        return prompt;
    }
  }

  private shouldPlan(taskState: TaskState): boolean {
    return !taskState.currentPlan || taskState.lastEvalDecision === 'REVISE_PLAN';
  }

  private async handleMissingInstruction(userPrompt: string, taskState: TaskState): Promise<TaskStatus> {
    if (taskState.plannerRetryCount < this.config.maxPlannerRetries) {
      taskState.plannerRetryCount++;
      const retryContext = this.buildContext('planRetry', userPrompt, taskState);
      return this.executePlanPhase(retryContext, taskState);
    } else {
      return TaskStatus.FAILED;
    }
  }

  private handleUserClarification(context: string, taskState: TaskState): { status: TaskStatus; nextContext: string } {
    // In a real implementation, this would request user input
    // For now, return a placeholder response
    taskState.userClarification = "Please proceed with the current plan";
    return { status: TaskStatus.IN_PROGRESS, nextContext: context };
  }

  private handleActionVerification(context: string, taskState: TaskState): { status: TaskStatus; nextContext: string } {
    // In a real implementation, this would request user verification
    // For now, assume verification is approved
    return { status: TaskStatus.IN_PROGRESS, nextContext: context };
  }

  private parsePlanResponse(content: string, taskState: TaskState): void {
    const checklistMatch = content.match(/<checklist>(.*?)<\/checklist>/s);
    const instructionMatch = content.match(/<instruction>(.*?)<\/instruction>/s);

    if (checklistMatch) {
      taskState.currentPlan = checklistMatch[1].trim();
      taskState.planArray = this.parsePlanArray(taskState.currentPlan);
    }

    if (instructionMatch) {
      taskState.currentInstruction = instructionMatch[1].trim();
      taskState.stepIndex = 0;
    }
  }

  private parseEvaluationDecision(content: string): string {
    const decisionMatch = content.match(/<decision>(.*?)<\/decision>/s);
    return decisionMatch ? decisionMatch[1].trim() : 'CONTINUE_PLAN';
  }

  private resetForNextInstruction(taskState: TaskState): void {
    taskState.stepIndex++;
    taskState.currentInstruction = taskState.planArray[taskState.stepIndex] || '';
    taskState.actionRetryCount = 0;
  }

  private resetForPlanRevision(taskState: TaskState): void {
    taskState.currentPlan = '';
    taskState.planArray = [];
    taskState.stepIndex = 0;
    taskState.currentInstruction = '';
    taskState.plannerRetryCount = 0;
  }

  private parsePlanArray(plan: string): string[] {
    return plan.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
  }

  private createInitialTaskState(): TaskState {
    return {
      currentPlan: '',
      currentInstruction: '',
      planArray: [],
      stepIndex: 0,
      lastActionTaken: '',
      lastActionResult: '',
      userClarification: '',
      lastEvalDecision: '',
      iteration: 0,
      plannerSummary: '',
      actorSummary: '',
      evaluatorSummary: '',
      plannerRetryCount: 0,
      actionRetryCount: 0,
      evalRetryCount: 0
    };
  }

  private getTaskResultMessage(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.COMPLETED: return 'Task completed successfully';
      case TaskStatus.FAILED: return 'Task failed to complete';
      case TaskStatus.CANCELLED: return 'Task was cancelled';
      default: return 'Task status unknown';
    }
  }

  private setupEventForwarding(): void {
    [this.planAgent, this.actionAgent, this.evaluationAgent].forEach(agent => {
      agent.on('error', (error) => this.emit('agentError', error));
      agent.on('warning', (warning) => this.emit('agentWarning', warning));
    });
  }

  private async requestUserClarification(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.emit('clarificationNeeded', { question, resolve });
    });
  }

  private async requestActionVerification(action: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.emit('verificationNeeded', { action, resolve });
    });
  }

  getConfig(): OrchestratorConfig {
    return { ...this.config };
  }
}
