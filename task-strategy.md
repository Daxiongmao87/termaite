# Task Strategy: 1.3.1 Define Core Type System

## Objective
Create comprehensive TypeScript type definitions for the core package that will support the multi-agent architecture, LLM integration, configuration management, and streaming infrastructure.

## Analysis of Requirements
Based on the Python codebase and existing CLI types, I need to define:

1. **Agent Event Types** - Communication between agents
2. **Agent Response Types** - Structured outputs from agents
3. **LLM Types** - Communication with language models
4. **Configuration Types** - System and user configuration
5. **Streaming Types** - Real-time event streaming

## Implementation Plan

### Step 1: Create Core Type System File
- File: `packages/core/src/types.ts`
- Define all core interfaces and types
- Ensure compatibility with existing CLI types
- Follow TypeScript best practices

### Step 2: Categories of Types to Define

#### Agent System Types
- `BaseAgentInterface` - Common agent contract
- `AgentType` - Plan, Action, Evaluation agents
- `AgentState` - Current execution state
- `AgentEvent` - Messages between agents
- `AgentResponse` - Structured agent outputs
- `AgentContext` - Execution context for agents

#### LLM Integration Types
- `LLMProvider` - Different LLM providers (Ollama, OpenAI, etc.)
- `LLMRequest` - Structured request to LLM
- `LLMResponse` - Complete LLM response
- `LLMChunk` - Streaming response chunks
- `LLMError` - Error handling for LLM failures

#### Configuration Types
- `ConfigurationOptions` - User configuration structure
- `OperationMode` - normal/gremlin/goblin modes
- `CommandPermissions` - Whitelist/blacklist configuration
- `LLMConfig` - LLM endpoint and model configuration

#### Streaming Infrastructure Types
- `StreamEvent` - Events for real-time updates
- `StreamEventType` - Types of streaming events
- `EventEmitter` - Event emission interface
- `StreamState` - Current streaming state

#### Task Management Types
- `TaskDefinition` - User-defined tasks
- `TaskExecution` - Running task state
- `TaskResult` - Execution outcomes
- `TaskContext` - Environment and state for task execution

### Step 3: Validation
- Ensure types compile without errors
- Verify compatibility with existing CLI types
- Test type safety and intellisense
- Check integration potential with future modules

## Files to Create/Modify
- `packages/core/src/types.ts` (new file)

## Success Criteria
- All types defined and documented
- TypeScript compilation succeeds
- Types are extensible for future features
- Compatible with existing CLI interfaces
- Supports the three-agent architecture from Python codebase
- Use simpler prompt templates for non-agentic mode

### Step 3: Update Application Layer
**File**: `termaite/core/application.py`
- Modify `handle_task()` to route between simple and agentic modes
- Add mode parameter to initialization
- Update `run_single_task()` and `run_interactive_mode()` to use appropriate handler

### Step 4: Create Simple Mode Prompts
**File**: `termaite/config/templates.py`
- Add simple response prompt template
- Template should handle both informational queries and command requests
- Keep it lightweight compared to the complex agent prompts

### Step 5: Update Configuration
**File**: `termaite/config/manager.py` (if needed)
- Ensure configuration supports simple mode
- May need to add simple_prompt to config templates

### Step 6: Update Documentation
**Files**: `README.md`, `IMPLEMENTATION.md`
- Update usage examples to show new default behavior
- Document the new flags and mode differences
- Update architecture description

## Files to Modify
1. `termaite/cli.py` - Add mode flags, update argument parsing
2. `termaite/core/application.py` - Route between simple/agentic modes
3. `termaite/core/simple_handler.py` - NEW: Simple response handler
4. `termaite/config/templates.py` - Add simple mode prompt
5. `README.md` - Update usage examples and documentation
6. `IMPLEMENTATION.md` - Update architecture documentation

## Testing Strategy
- Test simple mode with informational queries (no command expected)
- Test simple mode with action requests (command expected)
- Test agentic mode with `-a` flag (should work as before)
- Test interactive mode with both simple and agentic modes
- Verify backward compatibility

## Key Design Considerations
1. **Backward Compatibility**: Agentic mode should work exactly as before when `-a` flag is used
2. **Command Detection**: Simple mode needs to intelligently decide when to include commands vs just text
3. **Safety**: Simple mode should still respect operation modes and command permissions
4. **User Experience**: Default should feel natural and responsive for simple queries

## Success Criteria
- `termaite 'take me to my home directory'` returns message + `cd ~` command
- `termaite 'what is the best programming language'` returns just a message
- `termaite -a 'complex multi-step task'` works exactly as current implementation
- Interactive mode supports both simple responses and `-a` flag usage
- All existing functionality preserved when using agentic mode
