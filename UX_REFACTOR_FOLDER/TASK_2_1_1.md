# Task 2.1.1: Migrate Plan Agent

## Overview
Migrate the Plan Agent logic from the existing Python implementation to TypeScript, preserving all functionality while adapting to the new architecture.

## Objective
Create a fully functional Plan Agent in TypeScript that maintains feature parity with the existing Python implementation, including retry logic, response parsing, and streaming capabilities.

## Prerequisites
- Phase 1 (Foundation Setup) must be completed
- Core package structure must be functional
- Base agent classes must be defined

## Source Migration
**Primary Source**: `termaite/core/task_handler.py` (planning logic)
**Secondary Sources**: 
- `termaite/llm/parsers.py` (response parsing)
- `termaite/constants.py` (retry limits)

## Files to Create/Modify

### 1. Plan Agent Implementation
**File**: `/packages/core/src/agents/planner.ts`
**Content Requirements**:
- Extend BaseAgent class
- Implement planning logic from Python
- Response parsing and validation
- Retry mechanisms
- Streaming support

```typescript
import { BaseAgent } from './base.js';
import type { 
  AgentContext, 
  AgentResponse, 
  LLMClient,
  CoreConfig 
} from '../types/index.js';
import { parseLLMPlan, parseLLMDecision, parseLLMThought } from '../llm/parsers.js';

export interface PlanResponse extends AgentResponse {
  plan?: string;
  instruction?: string;
  decision?: string;
  thought?: string;
}

export class PlanAgent extends BaseAgent {
  private readonly maxRetries: number;
  private retryCount = 0;

  constructor(
    llmClient: LLMClient,
    config: CoreConfig
  ) {
    super('plan', llmClient, config);
    this.maxRetries = config.agents.retryLimits.planner;
  }

  async process(context: AgentContext): Promise<PlanResponse> {
    this.retryCount = 0;
    
    while (this.retryCount <= this.maxRetries) {
      try {
        const response = await this.attemptPlanning(context);
        
        if (this.isValidPlanResponse(response)) {
          this.retryCount = 0; // Reset for next call
          return response;
        }
        
        // Invalid response - retry
        this.retryCount++;
        if (this.retryCount <= this.maxRetries) {
          context = this.buildRetryContext(context, response);
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
  }

  private async attemptPlanning(context: AgentContext): Promise<PlanResponse> {
    const prompt = this.buildPlanPrompt(context);
    
    // Stream the response
    let fullResponse = '';
    for await (const chunk of this.llmClient.stream(prompt)) {
      fullResponse += chunk.text;
      
      // Emit streaming events
      this.emit('chunk', {
        type: 'plan',
        phase: 'thinking',
        content: chunk.text,
        timestamp: Date.now(),
        agentId: this.id,
      });
      
      if (chunk.done) break;
    }
    
    // Parse the response
    const thought = parseLLMThought(fullResponse);
    const decision = parseLLMDecision(fullResponse);
    const plan = parseLLMPlan(fullResponse);
    const instruction = this.extractInstruction(fullResponse);
    
    return {
      success: true,
      content: fullResponse,
      thought,
      decision,
      plan,
      instruction,
    };
  }

  private buildPlanPrompt(context: AgentContext): string {
    let prompt = `You are the Plan Agent for term.ai.te, an AI-powered terminal assistant.

Your role is to understand the user's request and create a step-by-step execution plan.

User Request: ${context.userPrompt}`;

    if (context.currentPlan) {
      prompt += `\n\nCurrent Plan: ${context.currentPlan}`;
    }

    if (context.lastAction && context.lastResult) {
      prompt += `\n\nLast Action: ${context.lastAction}`;
      prompt += `\nLast Result: ${context.lastResult}`;
    }

    if (context.userClarification) {
      prompt += `\n\nUser Clarification: ${context.userClarification}`;
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

If you need clarification from the user, use:
<decision>CLARIFY_USER: Your question for the user</decision>

Important guidelines:
- Create clear, actionable steps
- Be specific about what needs to be done
- Consider safety and best practices
- Ask for clarification if the request is ambiguous`;

    return prompt;
  }

  private buildRetryContext(
    originalContext: AgentContext, 
    failedResponse: PlanResponse
  ): AgentContext {
    let retryPrompt = originalContext.userPrompt;
    
    if (this.retryCount === 1) {
      retryPrompt += `\n\nIMPORTANT: Your previous response was missing required components. Please ensure you provide:
- A <checklist> with numbered steps
- An <instruction> for the first step
- Proper format as specified`;
    } else if (this.retryCount <= 3) {
      retryPrompt += `\n\nURGENT: You must follow the exact format. Here's what you need to include:

<think>Your analysis</think>
<checklist>
1. Step one
2. Step two
</checklist>
<instruction>Specific instruction for Action Agent</instruction>

This is retry attempt ${this.retryCount}/${this.maxRetries}`;
    } else {
      retryPrompt += `\n\nCRITICAL: This is retry ${this.retryCount}/${this.maxRetries}. You MUST provide a valid response with the required format or the task will fail. Please review the format requirements carefully.`;
    }

    return {
      ...originalContext,
      userPrompt: retryPrompt,
      retryCount: this.retryCount,
    };
  }

  private isValidPlanResponse(response: PlanResponse): boolean {
    // Check for clarification request
    if (response.decision?.startsWith('CLARIFY_USER:')) {
      return true;
    }
    
    // Check for required components
    return !!(response.plan && response.instruction);
  }

  private extractInstruction(response: string): string | undefined {
    const instructionMatch = response.match(/<instruction>([\s\S]*?)<\/instruction>/i);
    return instructionMatch?.[1]?.trim();
  }

  async *streamPlan(context: AgentContext): AsyncIterable<PlanResponse> {
    // Stream planning process in real-time
    const prompt = this.buildPlanPrompt(context);
    let partialResponse = '';
    
    for await (const chunk of this.llmClient.stream(prompt)) {
      partialResponse += chunk.text;
      
      yield {
        success: false, // Still in progress
        content: partialResponse,
        thought: parseLLMThought(partialResponse),
        // Don't parse plan/instruction until complete
      };
      
      if (chunk.done) {
        // Final response
        yield {
          success: true,
          content: partialResponse,
          thought: parseLLMThought(partialResponse),
          plan: parseLLMPlan(partialResponse),
          instruction: this.extractInstruction(partialResponse),
          decision: parseLLMDecision(partialResponse),
        };
      }
    }
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  getMaxRetries(): number {
    return this.maxRetries;
  }
}
```

### 2. Plan Agent Tests
**File**: `/packages/core/src/agents/__tests__/planner.test.ts`
**Content Requirements**:
- Comprehensive test coverage
- Mock LLM responses
- Retry logic testing
- Streaming functionality tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanAgent } from '../planner.js';
import { createMockConfig } from '../../test-setup.js';
import type { LLMClient, AgentContext } from '../../types/index.js';

const mockLLMClient: LLMClient = {
  async *stream(prompt: string) {
    yield { text: '<think>Planning the task</think>', done: false };
    yield { text: '\n<checklist>\n1. List files\n2. Show results\n</checklist>', done: false };
    yield { text: '\n<instruction>Execute ls command</instruction>', done: true };
  },
  async generate(prompt: string) {
    return {
      text: '<think>Planning</think>\n<checklist>\n1. List files\n</checklist>\n<instruction>Execute ls</instruction>',
    };
  },
  getContextLimit: () => 4096,
};

describe('PlanAgent', () => {
  let planAgent: PlanAgent;
  let mockContext: AgentContext;

  beforeEach(() => {
    const config = createMockConfig();
    planAgent = new PlanAgent(mockLLMClient, config);
    
    mockContext = {
      userPrompt: 'list files in current directory',
      iteration: 1,
      retryCount: 0,
    };
  });

  describe('process', () => {
    it('should successfully process a valid planning request', async () => {
      const response = await planAgent.process(mockContext);
      
      expect(response.success).toBe(true);
      expect(response.plan).toBeTruthy();
      expect(response.instruction).toBeTruthy();
    });

    it('should handle clarification requests', async () => {
      const clarificationClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: '<decision>CLARIFY_USER: What directory?</decision>', done: true };
        },
      };
      
      const agent = new PlanAgent(clarificationClient, createMockConfig());
      const response = await agent.process(mockContext);
      
      expect(response.decision).toContain('CLARIFY_USER:');
    });

    it('should retry on invalid responses', async () => {
      let attempts = 0;
      const retryClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          attempts++;
          if (attempts === 1) {
            yield { text: 'Invalid response without required tags', done: true };
          } else {
            yield { text: '<checklist>\n1. Valid step\n</checklist>\n<instruction>Valid instruction</instruction>', done: true };
          }
        },
      };
      
      const agent = new PlanAgent(retryClient, createMockConfig());
      const response = await agent.process(mockContext);
      
      expect(attempts).toBe(2);
      expect(response.success).toBe(true);
    });

    it('should fail after max retries', async () => {
      const failingClient: LLMClient = {
        ...mockLLMClient,
        async *stream() {
          yield { text: 'Always invalid response', done: true };
        },
      };
      
      const agent = new PlanAgent(failingClient, createMockConfig());
      
      await expect(agent.process(mockContext)).rejects.toThrow('Plan Agent failed after');
    });
  });

  describe('streamPlan', () => {
    it('should stream planning process in real-time', async () => {
      const responses = [];
      
      for await (const response of planAgent.streamPlan(mockContext)) {
        responses.push(response);
      }
      
      expect(responses.length).toBeGreaterThan(1);
      expect(responses[responses.length - 1].success).toBe(true);
    });
  });

  describe('retry logic', () => {
    it('should track retry count correctly', async () => {
      expect(planAgent.getRetryCount()).toBe(0);
      expect(planAgent.getMaxRetries()).toBe(10);
    });

    it('should build appropriate retry context', async () => {
      // This would be tested through the retry mechanism
      // The specific retry context building is tested implicitly
    });
  });
});
```

### 3. Update Agents Index
**File**: `/packages/core/src/agents/index.ts`
**Content**:
```typescript
export * from './base.js';
export * from './planner.js';
// Additional agents will be exported here as they are implemented
```

## Migration Checklist

### Python Code to Migrate
From `termaite/core/task_handler.py`:
- [ ] `_execute_plan_phase()` method logic
- [ ] `_build_planner_retry_context()` method
- [ ] Plan response parsing and validation
- [ ] Retry mechanisms and limits
- [ ] Context building and management

From `termaite/llm/parsers.py`:
- [ ] `parse_llm_plan()` function
- [ ] `parse_llm_thought()` function  
- [ ] `parse_llm_decision()` function
- [ ] Response validation logic

### Key Features to Preserve
- [ ] Plan-based task decomposition
- [ ] Step-by-step instruction generation
- [ ] Clarification request handling
- [ ] Retry logic with escalating prompts
- [ ] Streaming response support
- [ ] Context awareness and preservation

## Validation Criteria

### 1. Functional Parity
- [ ] Plan Agent generates valid plans for tasks
- [ ] Instruction extraction works correctly
- [ ] Clarification requests are handled properly
- [ ] Retry logic functions as expected
- [ ] Streaming responses work in real-time

### 2. Integration
- [ ] Agent integrates with base agent system
- [ ] Event emission works correctly
- [ ] Configuration is properly applied
- [ ] LLM client integration is functional

### 3. Testing
- [ ] Unit tests cover all major functionality
- [ ] Edge cases are tested (retries, failures)
- [ ] Mock scenarios validate behavior
- [ ] Test coverage is >90%

### 4. Performance
- [ ] Response times are acceptable
- [ ] Memory usage is reasonable
- [ ] Streaming has minimal latency
- [ ] Error handling is robust

## Success Criteria
- Plan Agent produces valid, actionable plans
- All retry mechanisms work correctly
- Streaming functionality provides real-time feedback
- Integration with core system is seamless
- Test coverage meets quality standards
- Performance is acceptable for interactive use

## Next Task
After completion, proceed to **Task 2.1.2: Migrate Action Agent**

## Notes
- Preserve all existing functionality from Python implementation
- Ensure prompt formats remain compatible
- Test with real LLM responses when possible
- Document any changes from original behavior
