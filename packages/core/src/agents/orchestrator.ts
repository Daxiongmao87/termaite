/**
 * Agent Orchestrator implementation - Plan-Act-Evaluate loop coordination
 */

import { EventEmitter } from 'events';
import type { LLMClient, CoreConfig, AgentResponse } from '../types/index.js';
import { PlanAgent } from './planner.js';
import { ActionAgent } from './actor.js';
import { EvaluationAgent } from './evaluator.js';
import { TaskState, TaskStatus, StateManager, AgentPhase, StateUtils } from './state.js';

export type EvaluationDecisionType = 'TASK_COMPLETE' | 'TASK_FAILED' | 'CONTINUE_PLAN' | 'REVISE_PLAN' | 'CLARIFY_USER' | 'VERIFY_ACTION';

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
  private stateManager: StateManager;

  constructor(llmClient: LLMClient, coreConfig: CoreConfig) {
    super();
    
    this.planAgent = new PlanAgent(llmClient, coreConfig);
    this.actionAgent = new ActionAgent(llmClient, coreConfig);
    this.evaluationAgent = new EvaluationAgent(llmClient, coreConfig);
    this.stateManager = new StateManager(false); // Disable persistence by default
    
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
    const taskState = this.stateManager.initializeState(userPrompt);
    let taskStatus = TaskStatus.IN_PROGRESS;
    let currentContext = userPrompt;

    this.emit('taskStarted', { userPrompt, taskState });

    try {
      while (taskStatus === TaskStatus.IN_PROGRESS) {
        taskState.incrementIteration();
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
          taskState.resetRetryCount(AgentPhase.PLAN);
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
        const retryCount = taskState.incrementRetryCount(AgentPhase.PLAN);
        if (retryCount <= this.config.maxPlannerRetries) {
          const retryContext = StateUtils.buildRetryContext(AgentPhase.PLAN, retryCount, context);
          return this.executePlanPhase(retryContext, taskState);
        } else {
          return TaskStatus.FAILED;
        }
      }

      this.emit('planCompleted', { plan: taskState.currentPlan, instruction: taskState.currentInstruction });
      return TaskStatus.IN_PROGRESS;

    } catch (error) {
      const retryCount = taskState.incrementRetryCount(AgentPhase.PLAN);
      if (retryCount <= this.config.maxPlannerRetries) {
        const retryContext = StateUtils.buildRetryContext(AgentPhase.PLAN, retryCount, context);
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
      taskState.addAgentSummary(response.data?.summary || '', AgentPhase.ACTION);

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
      taskState.addAgentSummary(response.data?.summary || '', AgentPhase.EVALUATE);

      this.emit('evaluationCompleted', { decision, evaluation: evalContent });

      return this.handleEvaluationDecision(decision, context, taskState);

    } catch (error) {
      const retryCount = taskState.incrementRetryCount(AgentPhase.EVALUATE);
      if (retryCount <= this.config.maxEvalRetries) {
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
          taskState.clearUserClarification();
        }
        return context;

      case 'evaluation':
        return `User's original request: '${prompt}'\n\nCurrent Plan Checklist:\n${taskState.currentPlan}\n\nInstruction that was attempted: '${taskState.currentInstruction}'\n\nAction Taken:\n${taskState.lastActionTaken}\n\nResult:\n${taskState.lastActionResult}`;

      case 'planRetry':
        const retryCount = taskState.getRetryCount(AgentPhase.PLAN);
        return StateUtils.buildRetryContext(AgentPhase.PLAN, retryCount, prompt);

      case 'continue':
        return `Continue with the next step in the plan:\n${taskState.currentPlan}\n\nCompleted step: ${taskState.currentInstruction}`;

      case 'revise':
        return `Revise the plan based on feedback:\n${taskState.lastEvalDecision}`;

      default:
        return prompt;
    }
  }

  private shouldPlan(taskState: TaskState): boolean {
    return taskState.needsNewPlan();
  }

  private async handleMissingInstruction(userPrompt: string, taskState: TaskState): Promise<TaskStatus> {
    const retryCount = taskState.getRetryCount(AgentPhase.PLAN);
    if (retryCount < this.config.maxPlannerRetries) {
      taskState.incrementRetryCount(AgentPhase.PLAN);
      const retryContext = StateUtils.buildRetryContext(AgentPhase.PLAN, retryCount + 1, userPrompt);
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
    taskState.resetRetryCount(AgentPhase.ACTION);
  }

  private resetForPlanRevision(taskState: TaskState): void {
    taskState.resetForPlanRevision();
  }

  private parsePlanArray(plan: string): string[] {
    return plan.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'));
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
