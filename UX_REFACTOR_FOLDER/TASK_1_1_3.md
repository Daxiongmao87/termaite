# Task 1.1.3: Create Core Package Structure

## Overview
Create the Core package structure that will house the backend logic, agent system, LLM integration, and all core functionality migrated from the Python implementation.

## Objective
Set up the packages/core directory with TypeScript configuration and the foundation for migrating all backend functionality from the existing Python codebase.

## Prerequisites
- Task 1.1.1 (Create Monorepo Structure) must be completed
- Task 1.1.2 (Create CLI Package Structure) must be completed
- Root workspace configuration must be functional

## Files to Create/Modify

### 1. Core Package Configuration
**File**: `/packages/core/package.json`
**Content Requirements**:
- Node.js backend dependencies
- TypeScript configuration
- Build and development scripts
- Core functionality exports

```json
{
  "name": "@termaite/core",
  "version": "2.0.0",
  "description": "Core backend functionality for term.ai.te",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "nodemon --watch src --ext ts --exec \"npm run build\"",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "type-check": "tsc --noEmit",
    "clean": "rimraf dist"
  },
  "dependencies": {
    "ws": "^8.14.0",
    "yaml": "^2.3.0",
    "node-fetch": "^3.3.0",
    "chalk": "^5.3.0",
    "eventemitter3": "^5.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",
    "@types/ws": "^8.5.0",
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "nodemon": "^3.0.0"
  }
}
```

### 2. TypeScript Configuration
**File**: `/packages/core/tsconfig.json`
**Content Requirements**:
- Core-specific TypeScript settings
- Node.js backend configuration
- Module resolution for monorepo

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    },
    "types": ["node", "vitest/globals"]
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "dist",
    "node_modules",
    "**/*.test.*"
  ]
}
```

### 3. Test Configuration
**File**: `/packages/core/vitest.config.ts`
**Content Requirements**:
- Vitest configuration for backend testing
- Coverage configuration
- Mock configurations

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'dist/**',
        '**/*.test.*',
        '**/*.d.ts',
        '**/test-setup.ts'
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 4. Main Export File
**File**: `/packages/core/src/index.ts`
**Content Requirements**:
- Main exports for the core package
- Public API surface
- Type exports

```typescript
// Core types
export * from './types/index.js';

// Agent system
export * from './agents/index.js';

// LLM integration
export * from './llm/index.js';

// Communication
export * from './communication/index.js';

// Configuration
export * from './config/index.js';

// Commands
export * from './commands/index.js';

// Context management
export * from './context/index.js';

// Streaming
export * from './streaming/index.js';

// Services
export * from './services/index.js';

// Utilities
export * from './utils/index.js';

// Main application class
export { CoreApplication } from './core-application.js';
```

### 5. Core Types Definition
**File**: `/packages/core/src/types/index.ts`
**Content Requirements**:
- All core type definitions
- Interfaces for agents, LLM, configuration
- Shared types across the core package

```typescript
// Agent-related types
export interface AgentContext {
  userPrompt: string;
  currentPlan?: string;
  currentInstruction?: string;
  lastAction?: string;
  lastResult?: string;
  userClarification?: string;
  iteration: number;
  retryCount: number;
}

export interface AgentResponse {
  success: boolean;
  content: string;
  thought?: string;
  decision?: string;
  instruction?: string;
  error?: string;
}

export interface AgentEvent {
  type: 'plan' | 'action' | 'evaluate';
  phase: string;
  content: string;
  timestamp: number;
  agentId: string;
}

// LLM-related types
export interface LLMChunk {
  text: string;
  done: boolean;
  error?: string;
}

export interface LLMResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
  finishReason?: string;
}

export interface LLMClient {
  stream(prompt: string): AsyncIterable<LLMChunk>;
  generate(prompt: string): Promise<LLMResponse>;
  getContextLimit(): number;
}

// Configuration types
export interface CoreConfig {
  llm: {
    endpoint: string;
    model: string;
    contextLimit: number;
    timeout: number;
    apiKey?: string;
  };
  agents: {
    retryLimits: {
      planner: number;
      action: number;
      evaluator: number;
    };
  };
  commands: {
    timeout: number;
    allowedCommands: Record<string, string>;
    blacklistedCommands: string[];
  };
  context: {
    maxTokens: number;
    compactThreshold: number;
  };
  ui: {
    streaming: boolean;
  };
}

// Communication types
export interface Message {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
}

export interface StreamEvent {
  type: string;
  data: any;
  timestamp: number;
}

// Command execution types
export interface CommandResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  duration: number;
}

export interface CommandPermission {
  command: string;
  allowed: boolean;
  reason?: string;
}

// Task and state types
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
  plannerRetryCount: number;
  actionRetryCount: number;
  evalRetryCount: number;
}

export enum TaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum AgentPhase {
  PLAN = 'plan',
  ACTION = 'action',
  EVALUATE = 'evaluate',
}
```

### 6. Core Application Class
**File**: `/packages/core/src/core-application.ts`
**Content Requirements**:
- Main application orchestrator
- Service initialization
- Lifecycle management
- Configuration management

```typescript
import { EventEmitter } from 'eventemitter3';
import type { CoreConfig } from './types/index.js';

export interface CoreApplicationOptions {
  config?: Partial<CoreConfig>;
  configPath?: string;
  debug?: boolean;
}

export class CoreApplication extends EventEmitter {
  private config: CoreConfig | null = null;
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(private options: CoreApplicationOptions = {}) {
    super();
    this.setupErrorHandling();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('CoreApplication is already initialized');
    }

    try {
      // TODO: Load configuration
      this.emit('initializing');
      
      // TODO: Initialize services
      // - Configuration service
      // - Agent service
      // - LLM service
      // - Command service
      // - Communication service
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('shutting-down');

    try {
      // TODO: Shutdown services gracefully
      // - Close connections
      // - Save state
      // - Clean up resources
      
      this.isInitialized = false;
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getConfig(): CoreConfig | null {
    return this.config;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isShuttingDown;
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason) => {
      this.emit('error', reason);
    });

    process.on('SIGINT', () => {
      this.shutdown().catch((error) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      this.shutdown().catch((error) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
    });
  }
}
```

### 7. Test Setup
**File**: `/packages/core/src/test-setup.ts`
**Content Requirements**:
- Test environment configuration
- Mock setup for dependencies
- Global test utilities

```typescript
import { vi } from 'vitest';

// Mock file system operations
vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
  },
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

// Mock child process for command execution
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
  execSync: vi.fn(),
}));

// Mock WebSocket for communication
vi.mock('ws', () => ({
  WebSocketServer: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
  WebSocket: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  })),
}));

// Mock node-fetch for HTTP requests
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

// Global test setup
global.console = {
  ...console,
  // Suppress console output during tests unless explicitly needed
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
};

// Test utilities
export const createMockConfig = () => ({
  llm: {
    endpoint: 'http://localhost:11434/api/generate',
    model: 'llama3',
    contextLimit: 4096,
    timeout: 30,
  },
  agents: {
    retryLimits: {
      planner: 10,
      action: 5,
      evaluator: 5,
    },
  },
  commands: {
    timeout: 30,
    allowedCommands: { ls: 'List files' },
    blacklistedCommands: ['rm -rf'],
  },
  context: {
    maxTokens: 4096,
    compactThreshold: 0.8,
  },
  ui: {
    streaming: true,
  },
});
```

### 8. Directory Structure
Create the following directories and index files:
```
packages/core/src/
├── agents/
├── llm/
├── communication/
├── config/
├── commands/
├── context/
├── streaming/
├── services/
├── utils/
└── __tests__/
```

**Files to create for directory structure**:
- `/packages/core/src/agents/index.ts`
- `/packages/core/src/llm/index.ts`
- `/packages/core/src/communication/index.ts`
- `/packages/core/src/config/index.ts`
- `/packages/core/src/commands/index.ts`
- `/packages/core/src/context/index.ts`
- `/packages/core/src/streaming/index.ts`
- `/packages/core/src/services/index.ts`
- `/packages/core/src/utils/index.ts`

Each index.ts should contain:
```typescript
// Export placeholder - will be populated in subsequent tasks
export {};
```

## Dependencies to Install
```bash
cd packages/core
npm install ws yaml node-fetch chalk eventemitter3 uuid
npm install --save-dev @types/uuid @types/ws vitest @vitest/coverage-v8 nodemon
```

## Validation Criteria

### 1. Package Structure
- [ ] packages/core directory exists with proper structure
- [ ] package.json is valid and includes all required dependencies
- [ ] TypeScript configuration compiles without errors
- [ ] All directory structures are created

### 2. Build System
- [ ] `npm run build` completes successfully
- [ ] `npm run type-check` passes without errors
- [ ] Build output is generated in dist/ directory
- [ ] All types are properly exported

### 3. Development Environment
- [ ] `npm run dev` starts development mode
- [ ] File watching works correctly
- [ ] Tests can be run with `npm test`
- [ ] Coverage reports are generated

### 4. Core Functionality
- [ ] CoreApplication class instantiates without errors
- [ ] Event system works correctly
- [ ] Basic lifecycle management functions
- [ ] Type definitions are comprehensive

## Success Criteria
- Core package structure is complete and functional
- TypeScript compilation works without errors
- Basic core application initializes successfully
- Development environment is operational
- All dependencies are properly installed
- Foundation is ready for migration tasks

## Next Task
After completion, proceed to **Task 1.1.4: Setup Build Configuration**

## Notes
- Ensure all type definitions are comprehensive
- Test core application lifecycle
- Verify monorepo workspace integration
- Prepare for Python code migration in Phase 2
