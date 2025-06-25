# Term.ai.te UX Refactoring Plan: Gemini-CLI Inspired Architecture

## Executive Summary

This document outlines a comprehensive plan to refactor term.ai.te to adopt the user experience and work// packages/core/src/llm/client.ts
export interface LLMClient {
  stream(prompt: string): AsyncIterable<LLMChunk>;
  generate(prompt: string): Promise<LLMResponse>;
  getContextLimit(): number;
}

// packages/core/src/llm/ollama.ts
export class OllamaClient implements LLMClient {
  constructor(private config: { endpoint: string; model: string; contextLimit: number }) {}
  
  async *stream(prompt: string): AsyncIterable<LLMChunk> {
    // Implement ollama streaming
  }
  
  getContextLimit(): number {
    return this.config.contextLimit;
  }
}
```

#### 2.3 Context Window Management
```typescript
// packages/core/src/context/manager.ts
export class ContextManager {
  constructor(private maxTokens: number) {}
  
  compactContext(messages: AgentMessage[]): AgentMessage[] {
    // Implement conversation compacting/summarization
    // Keep recent messages, summarize older ones
  }
}s of gemini-cli while maintaining our core ollama/OpenAI-compatible LLM support and multi-agent architecture. The MVP focuses exclusively on the agentic nature with a rich terminal UI powered by React/Ink.

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [MVP Scope Definition](#mvp-scope-definition)
4. [Technical Implementation Plan](#technical-implementation-plan)
5. [Migration Strategy](#migration-strategy)
6. [Implementation Phases](#implementation-phases)
7. [Risk Assessment](#risk-assessment)

## Current State Analysis

### Term.ai.te Strengths
- ✅ **Multi-agent architecture**: Plan/Action/Evaluation pattern is solid
- ✅ **Modular structure**: Already partially refactored into packages
- ✅ **LLM flexibility**: Works with ollama, OpenAI, and compatible APIs
- ✅ **Configuration-driven**: YAML-based config with good defaults
- ✅ **Safety features**: Command whitelisting, blacklisting, timeouts
- ✅ **Retry mechanisms**: Recently added robust retry logic

### Current Limitations
- ❌ **Poor UX**: Basic text output, no visual feedback
- ❌ **No streaming**: Static responses, no real-time updates
- ❌ **Limited interactivity**: Simple CLI prompts only
- ❌ **No visual state**: Users can't see what agents are thinking/doing
- ❌ **No history management**: Each session is isolated
- ❌ **No themes or customization**: Plain terminal output

### Gemini-CLI Strengths to Adopt
- ✅ **Rich terminal UI**: React/Ink-based interactive interface
- ✅ **Real-time streaming**: Live updates with visual feedback
- ✅ **Tool visualization**: Clear display of what's happening
- ✅ **Simple interactions**: Clean prompts with interrupt capability
- ✅ **Progress indicators**: Loading states and progress visualization

## Target Architecture

### High-Level Architecture

```
term.ai.te v2.0
├── packages/
│   ├── cli/                    # React/Ink frontend (NEW)
│   │   ├── src/
│   │   │   ├── ui/
│   │   │   │   ├── App.tsx     # Main UI application
│   │   │   │   ├── components/ # UI components
│   │   │   │   ├── hooks/      # React hooks
│   │   │   │   └── theme.ts    # Simple default theme
│   │   │   └── main.tsx        # CLI entry point
│   │   └── package.json
│   └── core/                   # Backend logic (ENHANCED)
│       ├── src/
│       │   ├── agents/         # Multi-agent system
│       │   ├── streaming/      # Real-time streaming (NEW)
│       │   ├── tools/          # Tool execution system
│       │   ├── config/         # Configuration management
│       │   ├── context/        # Context window management (NEW)
│       │   └── llm/            # LLM abstraction layer
│       └── package.json
├── pyproject.toml              # Python deps (if needed)
└── package.json                # Workspace root
```

### Component Breakdown

#### CLI Package (`packages/cli/`)
- **Purpose**: Rich terminal UI using React/Ink
- **Key Features**:
  - Interactive prompt with interrupt capability
  - Real-time streaming display
  - Agent thought visualization
  - Context window awareness
  - Simple default theme (extensible)

#### Core Package (`packages/core/`)
- **Purpose**: Backend logic and agent orchestration
- **Key Features**:
  - Multi-agent system (Plan/Action/Evaluation)
  - LLM abstraction (ollama/OpenAI support)
  - Tool execution framework
  - Streaming response handling
  - Configuration management
  - Context window management

## MVP Scope Definition

### 🎯 Core Features (MVP)

#### 1. Rich Terminal Interface
- **React/Ink-based UI** with live updates
- **Interactive prompt** with interrupt capability (Ctrl+C handling)
- **Real-time streaming** of agent responses
- **Visual agent states** (thinking, planning, acting, evaluating)

#### 2. Enhanced Agent Visualization
- **Plan Agent thoughts**: Show planning process in real-time
- **Action Agent execution**: Display commands being considered/executed
- **Evaluation Agent decisions**: Show decision-making process
- **Progress indicators**: Visual feedback for long-running operations

#### 3. Streaming Architecture
- **Real-time LLM responses**: Stream tokens as they arrive
- **Agent state updates**: Live updates of agent thinking
- **Tool execution feedback**: Show command execution in real-time
- **Error handling**: Graceful error display with retry options

#### 4. Core Ollama Support
- **Maintain compatibility** with existing ollama configurations
- **Streaming support** for ollama endpoints
- **Context window management** based on model configuration
- **Configuration migration** from existing YAML setup

### 🚫 Explicitly Out of Scope (MVP)

- File system integration (read_file, write_file tools)
- Web search capabilities
- Persistent history/memory management (only in-session context compacting)
- Extension/plugin architecture
- Advanced tool approval workflows
- Multi-model support
- Git integration
- Multiple theme support (single default theme only)
- Autocompletion features
- Advanced input interactions (beyond interrupts)

## Technical Implementation Plan

### Phase 1: Foundation Setup

#### 1.1 Project Structure Migration
```bash
# New directory structure
packages/
├── cli/                        # NEW: React/Ink frontend
│   ├── src/
│   │   ├── ui/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── AgentDisplay.tsx
│   │   │   │   ├── InputPrompt.tsx
│   │   │   │   ├── StreamingText.tsx
│   │   │   │   └── ProgressIndicator.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAgentStream.ts
│   │   │   │   ├── useInputHandler.ts
│   │   │   │   └── useInterrupt.ts
│   │   │   └── theme.ts              # Simple default theme
│   │   └── main.tsx
│   ├── package.json
│   └── tsconfig.json
└── core/                       # MIGRATED: Python/TypeScript hybrid
    ├── src/
    │   ├── agents/             # Migrated from termaite/agents/
    │   ├── streaming/          # NEW: Streaming capabilities
    │   ├── tools/              # Enhanced from termaite/commands/
    │   ├── config/             # Migrated from termaite/config/
    │   └── llm/                # Enhanced from termaite/llm/
    └── package.json
```

#### 1.2 Technology Stack
- **Frontend**: React + Ink + TypeScript
- **Backend**: Node.js + TypeScript (migrated from Python)
- **Communication**: JSON-RPC or WebSocket for CLI ↔ Core
- **Styling**: Ink styling system with theme support
- **Build**: ESBuild for fast compilation
- **Testing**: Vitest for unit tests

### Phase 2: Backend Migration

#### 2.1 Agent System Migration (Python → TypeScript)
```typescript
// packages/core/src/agents/base.ts
export abstract class BaseAgent {
  abstract async process(context: AgentContext): Promise<AgentResponse>;
}

// packages/core/src/agents/planner.ts
export class PlanAgent extends BaseAgent {
  async process(context: AgentContext): Promise<PlanResponse> {
    // Migrate existing Plan Agent logic
  }
}
```

#### 2.2 LLM Abstraction Layer
```typescript
// packages/core/src/llm/client.ts
export interface LLMClient {
  stream(prompt: string): AsyncIterable<LLMChunk>;
  generate(prompt: string): Promise<LLMResponse>;
}

// packages/core/src/llm/ollama.ts
export class OllamaClient implements LLMClient {
  async *stream(prompt: string): AsyncIterable<LLMChunk> {
    // Implement ollama streaming
  }
}
```

#### 2.4 Streaming Infrastructure
```typescript
// packages/core/src/streaming/agent-stream.ts
export class AgentStreamManager {
  async *processTask(task: string): AsyncIterable<AgentEvent> {
    // Yield plan events
    yield { type: 'plan', phase: 'thinking', content: '...' };
    
    // Yield action events  
    yield { type: 'action', phase: 'executing', command: 'ls -la' };
    
    // Yield evaluation events
    yield { type: 'evaluate', decision: 'continue' };
  }
}
```

### Phase 3: Frontend Development

#### 3.1 Core UI Components
```tsx
// packages/cli/src/ui/components/AgentDisplay.tsx
export const AgentDisplay: React.FC<{
  agentType: 'plan' | 'action' | 'evaluate';
  phase: string;
  content: string;
}> = ({ agentType, phase, content }) => {
  return (
    <Box borderStyle="round" borderColor="blue">
      <Text color="cyan">{agentType.toUpperCase()} Agent</Text>
      <Text color="gray"> - {phase}</Text>
      <Text>{content}</Text>
    </Box>
  );
};
```

#### 3.2 Streaming Text Component
```tsx
// packages/cli/src/ui/components/StreamingText.tsx
export const StreamingText: React.FC<{
  content: string;
  isComplete: boolean;
}> = ({ content, isComplete }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  
  useEffect(() => {
    // Implement typewriter effect
  }, [content]);
  
  return (
    <Text>
      {displayedContent}
      {!isComplete && <Text color="gray">▋</Text>}
    </Text>
  );
};
```

#### 3.3 Main Application Component
```tsx
// packages/cli/src/ui/App.tsx
export const App: React.FC = () => {
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  
  const handleSubmit = async (input: string) => {
    // Stream agent events and update UI
    for await (const event of agentStream.processTask(input)) {
      setAgentEvents(prev => [...prev, event]);
    }
  };
  
  return (
    <Box flexDirection="column" height="100%">
      <Header />
      <Box flexGrow={1}>
        <AgentEventList events={agentEvents} />
      </Box>
      <InputPrompt onSubmit={handleSubmit} />
    </Box>
  );
};
```

### Phase 4: Integration & Testing

#### 4.1 CLI ↔ Core Communication
```typescript
// packages/cli/src/core-client.ts
export class CoreClient {
  private socket: WebSocket;
  
  async *streamTask(task: string): AsyncIterable<AgentEvent> {
    this.socket.send(JSON.stringify({ type: 'task', payload: task }));
    
    for await (const message of this.socket) {
      yield JSON.parse(message);
    }
  }
}
```

#### 4.2 Configuration Migration
```typescript
// packages/core/src/config/migration.ts
export function migrateLegacyConfig(yamlConfig: any): ModernConfig {
  return {
    llm: {
      endpoint: yamlConfig.endpoint,
      model: yamlConfig.model || 'llama3',
      contextLimit: yamlConfig.context_limit || 4096, // Default context window
      timeout: yamlConfig.command_timeout || 30,
    },
    agents: {
      retryLimits: {
        planner: 10,
        action: 5,
        evaluator: 5,
      },
    },
    ui: {
      streaming: true,
    },
    context: {
      maxTokens: yamlConfig.context_limit || 4096,
      compactThreshold: 0.8, // Start compacting at 80% of context limit
    },
  };
}
```

## Migration Strategy

### 1. Backward Compatibility
- **Legacy CLI**: Keep `python -m termaite` working during transition
- **Configuration**: Auto-migrate existing YAML configs
- **Gradual Migration**: Allow users to opt-in to new UI

### 2. Feature Parity
- **All existing features** must work in new architecture
- **Enhanced experience** for agentic mode
- **Improved safety** with better command visualization

### 3. User Migration Path
```bash
# Phase 1: Legacy mode (current)
python -m termaite "task"

# Phase 2: Hybrid mode
npm install -g @termaite/cli
termaite --legacy "task"  # Falls back to Python

# Phase 3: New mode (default)
termaite "task"  # Rich UI experience
```

## Implementation Phases

### � Phase 1: Foundation Setup
- [ ] Set up monorepo structure with packages/
- [ ] Create CLI package with basic React/Ink setup
- [ ] Create Core package with TypeScript migration plan
- [ ] Implement basic streaming infrastructure

### � Phase 2: Backend Migration
- [ ] Migrate agent system to TypeScript
- [ ] Implement LLM abstraction layer
- [ ] Add ollama streaming support
- [ ] Create agent event streaming system

### 🎨 Phase 3: Frontend Development
- [ ] Build core UI components
- [ ] Implement agent visualization
- [ ] Add streaming text display
- [ ] Create input handling system

### � Phase 4: Integration
- [ ] Connect CLI to Core via WebSocket/JSON-RPC
- [ ] Implement configuration migration
- [ ] Add error handling and retry logic
- [ ] Create default theme system

### ✅ Phase 5: Testing & Polish
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Migration guide for users

## Risk Assessment

### 🔴 High Risk
1. **Technology Switch**: Python → TypeScript migration complexity
   - **Mitigation**: Gradual migration, keep Python fallback
2. **Performance**: React/Ink overhead vs. Python CLI
   - **Mitigation**: Optimize rendering, lazy loading
3. **Ollama Compatibility**: Streaming support variations
   - **Mitigation**: Extensive testing, fallback mechanisms

### 🟡 Medium Risk
1. **User Adoption**: Learning new interface
   - **Mitigation**: Gradual rollout, documentation, tutorials
2. **Configuration Migration**: Breaking existing setups
   - **Mitigation**: Auto-migration with validation

### 🟢 Low Risk
1. **UI Framework**: React/Ink is stable and proven
2. **Agent Logic**: Core algorithms remain unchanged
3. **LLM Integration**: Existing patterns transfer well

## Success Metrics

### User Experience
- [ ] **Response time**: < 100ms for UI updates
- [ ] **Streaming latency**: < 50ms for token display
- [ ] **User satisfaction**: Positive feedback on new interface

### Technical
- [ ] **Feature parity**: 100% of existing functionality
- [ ] **Test coverage**: > 80% for critical paths
- [ ] **Performance**: No degradation vs. current CLI

### Adoption
- [ ] **Migration rate**: > 80% of users adopt new UI within 3 months
- [ ] **Issue reduction**: < 50% of current UI-related issues
- [ ] **Documentation**: Complete migration guide and tutorials

## Conclusion

This refactoring plan transforms term.ai.te from a basic CLI tool into a modern, interactive terminal application while preserving its core multi-agent architecture and ollama compatibility. The MVP focuses on the essential agentic features with a streamlined UI experience - real-time agent visualization, interrupt capability, and context-aware conversation management.

The simplified scope removes complexity around themes, history persistence, and autocompletion while maintaining the abstraction layers needed for future extensibility. The React/Ink-based architecture provides excellent performance for real-time streaming with a clean, focused user experience.

**Next Steps**: Begin Phase 1 implementation with project structure setup and basic React/Ink integration.
