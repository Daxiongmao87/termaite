/**
 * Evaluation Agent implementation - Migrated from Python termaite.core.task_handler
 * 
 * This agent is responsible for evaluating action results and making decisions
 * about task continuation, completion, failure, or plan revision.
 */

import { BaseAgent, BaseAgentContext, AgentResponseData } from './base.js';
import type {
  AgentContext,
  LLMClient,
  CoreConfig,
  OperationMode
} from '../types/index.js';
import {
  parseLLMDecision,
  parseLLMThought,
  parseLLMSummary
} from '../llm/parsers.js';

export interface EvaluationResponse extends AgentResponseData {
  decision?: string;
  decisionType?: EvaluationDecisionType;
  message?: string;
  nextContext?: string;
  requiresUserInput?: boolean;
}

export type EvaluationDecisionType = 
  | 'TASK_COMPLETE'
  | 'TASK_FAILED'
  | 'CONTINUE_PLAN'
  | 'REVISE_PLAN'
  | 'CLARIFY_USER'
  | 'VERIFY_ACTION';

export interface EvaluationContext {
  originalRequest: string;
  currentPlan: string;
  currentInstruction: string;
  lastActionTaken: string;
  lastActionResult: string;
  userClarification?: string;
  retryCount?: number;
}

/**
 * Evaluation Agent responsible for assessing action results and making decisions
 */
export class EvaluationAgent extends BaseAgent {
  private readonly maxRetries: number;
  private readonly llmClient: LLMClient;
  private readonly config: CoreConfig;
  private retryCount = 0;

  constructor(llmClient: LLMClient, config: CoreConfig) {
    super('evaluator', 'evaluation');
    this.llmClient = llmClient;
    this.config = config;
    this.maxRetries = config.agents.retryLimits.evaluator;
  }

  /**
   * Validate input for evaluation
   */
  async validateInput(input: string): Promise<boolean> {
    try {
      const parsed = JSON.parse(input);
      return !!(parsed.originalRequest && parsed.lastActionTaken !== undefined && parsed.lastActionResult !== undefined);
    } catch {
      return false;
    }
  }

  /**
   * Process evaluation request and return decision
   */
  async process(input: string, context?: BaseAgentContext): Promise<EvaluationResponse> {
    this.retryCount = 0;
    
    try {
      const evalContext = this.extractEvaluationContext(input);
      return await this.evaluateWithRetry(evalContext);
    } catch (error) {
      console.error('Evaluation process failed:', error);
      return {
        id: `eval-${Date.now()}`,
        agentType: 'evaluation',
        status: 'error',
        content: '',
        timestamp: Date.now(),
        error: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        decisionType: 'TASK_FAILED',
        message: 'Evaluation agent encountered an error'
      };
    }
  }

  /**
   * Extract evaluation context from input
   */
  private extractEvaluationContext(input: string): EvaluationContext {
    try {
      const data = JSON.parse(input);
      return {
        originalRequest: data.originalRequest || '',
        currentPlan: data.currentPlan || '',
        currentInstruction: data.currentInstruction || '',
        lastActionTaken: data.lastActionTaken || '',
        lastActionResult: data.lastActionResult || '',
        userClarification: data.userClarification,
        retryCount: this.retryCount
      };
    } catch {
      // Fallback for plain string input
      return {
        originalRequest: input,
        currentPlan: '',
        currentInstruction: '',
        lastActionTaken: '',
        lastActionResult: '',
        retryCount: this.retryCount
      };
    }
  }

  /**
   * Evaluate with retry logic
   */
  private async evaluateWithRetry(evalContext: EvaluationContext): Promise<EvaluationResponse> {
    while (this.retryCount <= this.maxRetries) {
      try {
        const prompt = this.buildEvaluationPrompt(evalContext);
        console.debug('Sending evaluation prompt', { retryCount: this.retryCount });

        // Stream the LLM response
        let fullResponse = '';
        for await (const chunk of this.llmClient.stream(prompt)) {
          fullResponse += chunk.text;
          
          // Emit streaming events
          this.emit('stream', {
            type: 'agent_thinking',
            data: chunk.text,
            timestamp: Date.now()
          });

          if (chunk.done) break;
        }

        // Parse the response
        const response = this.parseEvaluationResponse(fullResponse, evalContext);
        
        if (response.status === 'success' && response.decisionType) {
          console.info('Evaluation completed', { 
            decisionType: response.decisionType,
            retryCount: this.retryCount 
          });
          return response;
        }

        // Invalid response - retry
        this.retryCount++;
        if (this.retryCount <= this.maxRetries) {
          console.warn('Invalid evaluation response, retrying', { 
            retryCount: this.retryCount,
            maxRetries: this.maxRetries 
          });
          evalContext.retryCount = this.retryCount;
        }

      } catch (error) {
        this.retryCount++;
        console.error('Evaluation attempt failed', error, { retryCount: this.retryCount });
        
        if (this.retryCount <= this.maxRetries) {
          evalContext.retryCount = this.retryCount;
          continue;
        }
        throw error;
      }
    }

    // All retries exhausted
    console.error('Max retries exhausted for evaluation');
    return {
      id: `eval-${Date.now()}`,
      agentType: 'evaluation',
      status: 'error',
      content: '',
      timestamp: Date.now(),
      error: `Evaluation failed after ${this.maxRetries} retries`,
      decisionType: 'TASK_FAILED',
      message: 'Evaluation agent failed to provide valid decision after retries'
    };
  }

  /**
   * Build evaluation prompt with context
   */
  private buildEvaluationPrompt(evalContext: EvaluationContext): string {
    const { retryCount = 0 } = evalContext;
    
    let prompt = `You are the "Evaluator" module of a multi-step AI assistant specialized in the Linux shell environment.
You will be given the original request, plan, action taken, and result.
Your primary goal is to assess the outcome and decide the next course of action.

REQUIRED OUTPUT FORMAT:
<think>Your evaluation reasoning</think>
<decision>DECISION_TYPE: Your message here</decision>

Original User Request: '${evalContext.originalRequest}'

Current Plan Checklist:
${evalContext.currentPlan}

Instruction that was attempted: '${evalContext.currentInstruction}'

Action Taken by Actor:
${evalContext.lastActionTaken}

Result of Action:
${evalContext.lastActionResult}`;

    // Add user clarification context
    if (evalContext.userClarification) {
      prompt += `\n\nContext: User responded '${evalContext.userClarification}' to my last question.`;
    }

    // Add decision type information
    prompt += `\n\nValid decision types:
- CONTINUE_PLAN: Move to the next step in the plan
- REVISE_PLAN: The plan needs to be updated  
- TASK_COMPLETE: The task objective has been achieved (no summary needed)
- TASK_FAILED: The task cannot be completed
- CLARIFY_USER: Need clarification from the user

If clarification from the user is absolutely necessary to evaluate the step, use <decision>CLARIFY_USER: Your question here</decision>.`;

    // Add retry-specific instructions
    if (retryCount > 0) {
      prompt += this.buildEvalRetryContext(retryCount);
    }

    prompt += `\n\nIMPORTANT: When marking TASK_COMPLETE, do NOT provide summaries or detailed explanations. 
Simply state that the task objective has been achieved. A separate completion summary will be generated.

Evaluate the action result and provide your decision:`;

    return prompt;
  }

  /**
   * Build enhanced context for evaluator retries
   */
  private buildEvalRetryContext(retryCount: number): string {
    if (retryCount === 1) {
      return `\n\nIMPORTANT: Your previous response did not include a proper <decision> section. 
You MUST provide a decision using this exact format:
<decision>DECISION_TYPE: Your message here</decision>

Valid decision types: CONTINUE_PLAN, REVISE_PLAN, TASK_COMPLETE, TASK_FAILED`;
    } else if (retryCount <= 3) {
      return `\n\nCRITICAL (Eval Retry ${retryCount}): You must include a decision tag:
<decision>CONTINUE_PLAN: Continue with next step</decision>
<decision>REVISE_PLAN: Plan needs updating</decision>
<decision>TASK_COMPLETE: Task objective achieved</decision>
<decision>TASK_FAILED: Task cannot be completed</decision>

Choose the most appropriate decision based on the action result.`;
    } else {
      return `\n\nURGENT (Eval Retry ${retryCount}): You MUST respond with a decision tag. 
Example: <decision>CONTINUE_PLAN: Moving to next step</decision>`;
    }
  }

  /**
   * Parse LLM response for evaluation
   */
  private parseEvaluationResponse(response: string, evalContext: EvaluationContext): EvaluationResponse {
    try {
      // Parse components
      const thought = parseLLMThought(response);
      const summary = parseLLMSummary(response);
      const decision = parseLLMDecision(response);

      const baseResponse: EvaluationResponse = {
        id: `eval-${Date.now()}`,
        agentType: 'evaluation',
        status: 'error',
        content: response,
        timestamp: Date.now()
      };

      if (!decision) {
        return {
          ...baseResponse,
          error: 'No decision found in evaluation response'
        };
      }

      // Extract decision type and message
      const { decisionType, message } = this.extractDecisionTypeAndMessage(decision);
      
      if (!this.isValidDecisionType(decisionType)) {
        return {
          ...baseResponse,
          error: `Invalid decision type: ${decisionType}`,
          decision
        };
      }

      // Build next context based on decision type
      const nextContext = this.buildNextContext(decisionType, message, evalContext);
      const requiresUserInput = decisionType === 'CLARIFY_USER';

      return {
        ...baseResponse,
        status: 'success',
        decision,
        decisionType,
        message,
        nextContext,
        requiresUserInput
      };

    } catch (error) {
      console.error('Failed to parse evaluation response', error);
      return {
        id: `eval-${Date.now()}`,
        agentType: 'evaluation',
        status: 'error',
        content: response,
        timestamp: Date.now(),
        error: `Response parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Extract decision type and message from decision string
   */
  private extractDecisionTypeAndMessage(decision: string): { decisionType: string; message: string } {
    const parts = decision.split(':', 2);
    const decisionType = parts[0]?.trim() || '';
    const message = parts[1]?.trim() || '';
    return { decisionType, message };
  }

  /**
   * Check if decision type is valid
   */
  private isValidDecisionType(decisionType: string): decisionType is EvaluationDecisionType {
    const validTypes: EvaluationDecisionType[] = [
      'TASK_COMPLETE',
      'TASK_FAILED', 
      'CONTINUE_PLAN',
      'REVISE_PLAN',
      'CLARIFY_USER',
      'VERIFY_ACTION'
    ];
    return validTypes.includes(decisionType as EvaluationDecisionType);
  }

  /**
   * Build next context based on evaluation decision
   */
  private buildNextContext(
    decisionType: EvaluationDecisionType,
    message: string,
    evalContext: EvaluationContext
  ): string | undefined {
    switch (decisionType) {
      case 'CONTINUE_PLAN':
        return `Original request: '${evalContext.originalRequest}'.
Current Plan:
${evalContext.currentPlan}
Prev instruction ('${evalContext.currentInstruction}') result: '${evalContext.lastActionResult}'.
Evaluator feedback: '${message}'.
Provide next instruction. If plan complete, instruct actor 'report_task_completion'.`;

      case 'REVISE_PLAN':
        return `Original request: '${evalContext.originalRequest}'.
Prev plan:
${evalContext.currentPlan}
Prev instruction ('${evalContext.currentInstruction}') result: '${evalContext.lastActionResult}'.
Evaluator suggests revision: '${message}'.
Revise checklist and provide new first instruction.`;

      case 'CLARIFY_USER':
        return `Original request: '${evalContext.originalRequest}'.
After action '${evalContext.lastActionTaken}' (result: '${evalContext.lastActionResult}'), 
evaluator needs clarification. Question: '${message}'.
User's answer: '[USER_RESPONSE_PLACEHOLDER]'.
Revise plan/next instruction based on this.`;

      case 'VERIFY_ACTION':
        return `Original request: '${evalContext.originalRequest}'.
Previous action: '${evalContext.lastActionTaken}' (result: '${evalContext.lastActionResult}').
Evaluator requests verification. Execute this command to verify the outcome: ${message}`;

      case 'TASK_COMPLETE':
      case 'TASK_FAILED':
      default:
        return undefined;
    }
  }

  /**
   * Check if agent can evaluate actions
   */
  canEvaluateActions(): boolean {
    return true;
  }

  /**
   * Get evaluation decision types
   */
  getValidDecisionTypes(): EvaluationDecisionType[] {
    return [
      'TASK_COMPLETE',
      'TASK_FAILED',
      'CONTINUE_PLAN', 
      'REVISE_PLAN',
      'CLARIFY_USER',
      'VERIFY_ACTION'
    ];
  }
}
