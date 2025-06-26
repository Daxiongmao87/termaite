/**
 * Action Agent implementation - Migrated from Python termaite.core.task_handler
 * 
 * This agent is responsible for executing commands and performing actions
 * based on instructions from the Plan Agent, with comprehensive safety checks.
 */

import { BaseAgent, BaseAgentContext, AgentResponseData } from './base.js';
import { CommandExecutor, CommandPermissionChecker, ActionUtils } from './action-utils.js';
import type {
  AgentContext,
  LLMClient,
  CoreConfig,
  CommandResult,
  OperationMode
} from '../types/index.js';
import {
  parseSuggestedCommand,
  parseLLMThought,
  parseLLMSummary
} from '../llm/parsers.js';

export interface ActionResponse extends AgentResponseData {
  command?: string;
  commandResult?: CommandResult;
  thought?: string;
  summary?: string;
  actionTaken?: string;
  actionResult?: string;
  requiresConfirmation?: boolean;
}

/**
 * Action Agent responsible for executing commands and performing actions
 */
export class ActionAgent extends BaseAgent {
  private readonly maxRetries: number;
  private readonly llmClient: LLMClient;
  private readonly config: CoreConfig;
  private readonly commandExecutor: CommandExecutor;
  private readonly permissionChecker: CommandPermissionChecker;
  private retryCount = 0;

  constructor(llmClient: LLMClient, config: CoreConfig) {
    super('actor', 'action');
    this.llmClient = llmClient;
    this.config = config;
    this.maxRetries = config.agents.retryLimits.action;
    this.commandExecutor = new CommandExecutor(config);
    this.permissionChecker = new CommandPermissionChecker(config);
  }

  /**
   * Validate input for action execution
   */
  async validateInput(input: string): Promise<boolean> {
    if (!input || typeof input !== 'string') {
      return false;
    }

    const trimmed = input.trim();
    return trimmed.length > 0 && trimmed.length <= 10000;
  }

  /**
   * Process instruction and execute appropriate action
   */
  async process(input: string, context?: BaseAgentContext): Promise<AgentResponseData> {
    await this.startProcessing(input);

    try {
      this.retryCount = 0;
      const agentContext = this.buildAgentContext(input, context);

      while (this.retryCount <= this.maxRetries) {
        try {
          const response = await this.attemptAction(agentContext);

          if (this.isValidActionResponse(response)) {
            this.retryCount = 0;
            await this.finishProcessing(response);
            return response;
          }

          this.retryCount++;
          if (this.retryCount <= this.maxRetries) {
            continue;
          }

        } catch (error) {
          this.retryCount++;
          if (this.retryCount > this.maxRetries) {
            throw error;
          }
        }
      }

      throw new Error(`Action Agent failed after ${this.maxRetries} retries`);

    } catch (error) {
      const errorResponse = this.createResponse(
        `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      userPrompt: '',
      currentPlan: '',
      currentInstruction: input,
      lastAction: '',
      lastResult: '',
      userClarification: '',
      iteration: 1,
      retryCount: this.retryCount
    };
  }

  /**
   * Attempt to execute an action based on the instruction
   */
  private async attemptAction(context: AgentContext): Promise<ActionResponse> {
    const prompt = this.buildActionPrompt(context);

    // Stream the response and emit events
    let fullResponse = '';
    for await (const chunk of this.llmClient.stream(prompt)) {
      fullResponse += chunk.text;

      this.emit('chunk', {
        type: 'action',
        phase: 'thinking',
        content: chunk.text,
        timestamp: Date.now(),
        agentId: this.getName(),
      });

      if (chunk.done) break;
    }

    // Parse components using utility
    const { thought, summary, command, textResponse } = ActionUtils.parseActionComponents(fullResponse);

    // Handle different types of responses
    if (command) {
      return await this.handleCommandSuggestion(command, fullResponse, thought, summary);
    } else {
      return this.handleTextResponse(fullResponse, textResponse, thought, summary);
    }
  }

  /**
   * Build the action prompt for the LLM
   */
  private buildActionPrompt(context: AgentContext): string {
    let prompt = `You are the Action Agent for term.ai.te, an AI-powered terminal assistant.

Your role is to execute the instruction provided by the Plan Agent.

Current Instruction: ${context.currentInstruction}`;

    if (context.currentPlan) {
      prompt += `\n\nOverall Plan: ${context.currentPlan}`;
    }

    if (context.lastAction && context.lastResult) {
      prompt += `\n\nPrevious Action: ${context.lastAction}`;
      prompt += `\nPrevious Result: ${context.lastResult}`;
    }

    prompt += `\n\nPlease provide your response in the following format:

<think>
Your analysis of the instruction and the action you need to take
</think>

If you need to execute a command, use:
\`\`\`agent_command
command_to_execute
\`\`\`

If the task appears complete, you can signal completion with:
\`\`\`agent_command
report_task_completion
\`\`\`

<summary>
Brief summary of the action taken for coordination with other agents
</summary>

Important guidelines:
- Execute commands safely and appropriately
- Be specific about what you're doing
- Use standard shell commands
- If unsure about a command, ask for clarification
- Always provide a summary of your actions`;

    return prompt;
  }

  /**
   * Handle a command suggestion from the Action Agent
   */
  private async handleCommandSuggestion(
    command: string,
    fullResponse: string,
    thought?: string,
    summary?: string
  ): Promise<ActionResponse> {
    
    // Special case: task completion signal
    if (command === 'report_task_completion') {
      this.emitThinking('Received task completion signal');
      
      return this.createResponse(
        fullResponse,
        'success',
        {
          data: {
            command,
            actionTaken: 'Internal signal: report_task_completion',
            actionResult: 'Action Agent determined task is complete and signaled Evaluator.',
            thought,
            summary,
            requiresConfirmation: false
          }
        }
      ) as ActionResponse;
    }

    // Check command permissions
    const operationMode = this.getOperationMode();
    const permission = await this.permissionChecker.checkPermission(command, operationMode);

    if (!permission.allowed) {
      return this.createResponse(
        fullResponse,
        'success',
        {
          data: {
            command,
            actionTaken: `Command '${command}' not executed.`,
            actionResult: `Command blocked: ${permission.reason}`,
            thought,
            summary,
            requiresConfirmation: false
          }
        }
      ) as ActionResponse;
    }

    // In normal mode, require user confirmation
    if (operationMode === 'normal') {
      return this.createResponse(
        fullResponse,
        'success',
        {
          data: {
            command,
            thought,
            summary,
            requiresConfirmation: true,
            actionTaken: ActionUtils.createActionMessage(command, false),
            actionResult: 'Awaiting user confirmation'
          }
        }
      ) as ActionResponse;
    }

    // Execute the command directly in other modes
    const result = await this.commandExecutor.execute(command);
    
    return this.createResponse(
      fullResponse,
      result.success ? 'success' : 'error',
      {
        data: {
          command,
          commandResult: result,
          actionTaken: ActionUtils.createActionMessage(command, true),
          actionResult: ActionUtils.formatCommandResult(result),
          thought,
          summary,
          requiresConfirmation: false
        }
      }
    ) as ActionResponse;
  }

  /**
   * Handle a text response from the Action Agent
   */
  private handleTextResponse(
    fullResponse: string,
    textResponse?: string,
    thought?: string,
    summary?: string
  ): ActionResponse {
    
    if (!textResponse) {
      return this.createResponse(
        fullResponse,
        'success',
        {
          data: {
            actionTaken: 'Actor: no command and no question',
            actionResult: `Actor LLM response empty or only thought: ${fullResponse}`,
            thought,
            summary
          }
        }
      ) as ActionResponse;
    }

    return this.createResponse(
      fullResponse,
      'success',
      {
        data: {
          actionTaken: 'Actor provided text response',
          actionResult: textResponse,
          thought,
          summary
        }
      }
    ) as ActionResponse;
  }

  /**
   * Get the current operation mode
   */
  private getOperationMode(): OperationMode {
    return this.context?.config?.operationMode || 'normal';
  }

  /**
   * Validate if the action response is valid
   */
  private isValidActionResponse(response: ActionResponse): boolean {
    return response.status === 'success' || response.status === 'error';
  }

  /**
   * Execute a command with user confirmation (for normal mode)
   */
  async executeWithConfirmation(command: string): Promise<CommandResult> {
    return await this.commandExecutor.execute(command);
  }

  /**
   * Get current retry count
   */
  getRetryCount(): number {
    return this.retryCount;
  }

  /**
   * Get maximum retry limit
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * Reset retry count for new action session
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }

  /**
   * Check if agent can execute commands safely
   */
  canExecuteCommands(): boolean {
    return true;
  }
}
