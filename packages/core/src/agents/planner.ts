/**
 * Plan Agent implementation - Migrated from Python termaite.core.task_handler
 * 
 * This agent is responsible for understanding user requests and creating
 * step-by-step execution plans with specific instructions for the Action Agent.
 */

import { BaseAgent, BaseAgentContext, AgentResponseData } from './base.js';
import type {
  AgentContext,
  AgentResponse,
  LLMClient,
  CoreConfig,
  AgentDecision
} from '../types/index.js';
import {
  parseLLMPlan,
  parseLLMInstruction,
  parseLLMDecision,
  parseLLMThought,
  parseLLMSummary,
  validateResponseFormat
} from '../llm/parsers.js';

export interface PlanResponse extends AgentResponseData {
  plan?: string;
  instruction?: string;
  decision?: string;
  thought?: string;
  summary?: string;
}

/**
 * Plan Agent responsible for creating execution plans from user requests
 */
export class PlanAgent extends BaseAgent {
  private readonly maxRetries: number;
  private readonly llmClient: LLMClient;
  private readonly config: CoreConfig;
  private retryCount = 0;

  constructor(llmClient: LLMClient, config: CoreConfig) {
    super('planner', 'plan');
    this.llmClient = llmClient;
    this.config = config;
    this.maxRetries = config.agents.retryLimits.planner;
  }

  /**
   * Validate input for plan generation
   * @param input User request or task description
   * @returns true if input is valid for planning
   */
  async validateInput(input: string): Promise<boolean> {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const trimmed = input.trim();
    return trimmed.length > 0 && trimmed.length <= 10000; // Reasonable length limit
  }

  /**
   * Process user request and generate execution plan
   * Implements retry logic for robust planning
   */
  async process(input: string, context?: BaseAgentContext): Promise<AgentResponseData> {
    await this.startProcessing(input);

    try {
      this.retryCount = 0;
      const agentContext = this.buildAgentContext(input, context);

      while (this.retryCount <= this.maxRetries) {
        try {
          const response = await this.attemptPlanning(agentContext);

          if (this.isValidPlanResponse(response)) {
            this.retryCount = 0; // Reset for next call
            await this.finishProcessing(response);
            return response;
          }

          // Invalid response - retry with enhanced context
          this.retryCount++;
          if (this.retryCount <= this.maxRetries) {
            agentContext.userPrompt = this.buildRetryPrompt(agentContext.userPrompt, response);
            continue;
          }

        } catch (error) {
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            throw error;
          }
        }
      }

      throw new Error(`Plan Agent failed after ${this.maxRetries} retries`);

    } catch (error) {
      const errorResponse = this.createResponse(
        `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      );
      
      this.emitError(error instanceof Error ? error : new Error(String(error)));
      await this.finishProcessing(errorResponse);
      return errorResponse;
    }
  }

  /**
   * Build agent context from base context and input
   */
  private buildAgentContext(input: string, baseContext?: BaseAgentContext): AgentContext {
    return {
      userPrompt: input,
      currentPlan: '',
      currentInstruction: '',
      lastAction: '',
      lastResult: '',
      userClarification: '',
      iteration: 1,
      retryCount: this.retryCount
    };
  }

  /**
   * Attempt to generate a plan from the given context
   * @param context The agent context containing user request and state
   * @returns PlanResponse with parsed components
   */
  private async attemptPlanning(context: AgentContext): Promise<PlanResponse> {
    const prompt = this.buildPlanPrompt(context);

    // Stream the response and emit events
    let fullResponse = '';
    for await (const chunk of this.llmClient.stream(prompt)) {
      fullResponse += chunk.text;

      // Emit streaming events for real-time feedback
      this.emit('chunk', {
        type: 'plan',
        phase: 'thinking',
        content: chunk.text,
        timestamp: Date.now(),
        agentId: this.getName(),
      });

      if (chunk.done) break;
    }

    // Parse the response components
    const thought = parseLLMThought(fullResponse);
    const decision = parseLLMDecision(fullResponse);
    const plan = parseLLMPlan(fullResponse);
    const instruction = parseLLMInstruction(fullResponse);
    const summary = parseLLMSummary(fullResponse);

    return this.createResponse(
      fullResponse,
      'success',
      {
        data: {
          thought,
          decision,
          plan,
          instruction,
          summary,
        }
      }
    ) as PlanResponse;
  }

  /**
   * Build retry prompt when planning fails
   */
  private buildRetryPrompt(originalPrompt: string, failedResponse: PlanResponse): string {
    // Add specific feedback based on what was missing
    const missingComponents: string[] = [];
    if (!failedResponse.plan) missingComponents.push('checklist');
    if (!failedResponse.instruction) missingComponents.push('instruction');

    if (missingComponents.length > 0) {
      return `${originalPrompt}\n\n[RETRY ${this.retryCount}/${this.maxRetries}] Missing: ${missingComponents.join(', ')}. Please provide a complete response with all required XML tags.`;
    }

    return originalPrompt;
  }

  /**
   * Build the planning prompt with context and retry guidance
   * @param context The agent context
   * @returns Formatted prompt for the LLM
   */
  private buildPlanPrompt(context: AgentContext): string {
    let prompt = `You are the Plan Agent for term.ai.te, an AI-powered terminal assistant.

Your role is to understand the user's request and create a step-by-step execution plan.

User Request: ${context.userPrompt}`;

    // Add current plan if exists (for plan revision)
    if (context.currentPlan) {
      prompt += `\n\nCurrent Plan: ${context.currentPlan}`;
    }

    // Add execution history if available
    if (context.lastAction && context.lastResult) {
      prompt += `\n\nLast Action: ${context.lastAction}`;
      prompt += `\nLast Result: ${context.lastResult}`;
    }

    // Add user clarification if provided
    if (context.userClarification) {
      prompt += `\n\nUser Clarification: ${context.userClarification}`;
    }

    // Add retry-specific guidance
    if (this.retryCount > 0) {
      prompt += this.getRetryGuidance();
    }

    prompt += `\n\nPlease provide your response in the following format:

<think>
Your reasoning and analysis of the request
</think>

<checklist>
1. First step to accomplish the task
2. Second step to accomplish the task
3. Additional steps as needed
</checklist>

<instruction>
Specific instruction for the Action Agent to execute the first step
</instruction>

<summary>
Brief summary of the plan for inter-agent coordination
</summary>

If you need clarification from the user, use:
<decision>CLARIFY_USER: Your question for the user</decision>

Important guidelines:
- Create clear, actionable steps
- Be specific about what needs to be done
- Consider safety and best practices
- Ask for clarification if the request is ambiguous
- Each step should be independently executable
- Focus on terminal commands and file operations`;

    return prompt;
  }

  /**
   * Generate retry-specific guidance based on retry count
   * @returns Additional guidance text for retries
   */
  private getRetryGuidance(): string {
    if (this.retryCount === 1) {
      return `\n\nIMPORTANT: Your previous response was missing required components. Please ensure you provide:
- A <checklist> with numbered steps
- An <instruction> for the first step
- Proper format as specified`;
    } else if (this.retryCount <= 3) {
      return `\n\nURGENT: You must follow the exact format. Here's what you need to include:

<think>Your analysis</think>
<checklist>
1. Step one
2. Step two
</checklist>
<instruction>Specific instruction for Action Agent</instruction>
<summary>Brief plan summary</summary>

This is retry attempt ${this.retryCount}/${this.maxRetries}`;
    } else {
      return `\n\nCRITICAL: This is retry ${this.retryCount}/${this.maxRetries}. You MUST provide a valid response with the required format or the task will fail. Please review the format requirements carefully.`;
    }
  }

  /**
   * Validate if the plan response contains all required components
   * @param response The plan response to validate
   * @returns true if response is valid
   */
  private isValidPlanResponse(response: PlanResponse): boolean {
    const data = response.data;
    if (!data) return false;

    // Check for clarification request (this is valid)
    if (data.decision?.startsWith('CLARIFY_USER:')) {
      return true;
    }

    // Check for required components
    return !!(data.plan && data.instruction);
  }

  /**
   * Get current retry count
   * @returns Current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get maximum retry limit
   * @returns Maximum retry limit
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Reset retry count for new planning session
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Extract plan items from checklist format
   * @param plan Raw plan text from LLM
   * @returns Array of plan items
   */
  getPlanItems(plan: string): string[] {
    if (!plan) return [];

    return plan
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Remove numbering and list markers
        return line.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '');
      });
  }
}
