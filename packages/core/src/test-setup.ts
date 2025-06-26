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
      planner: 3,
      action: 3,
      evaluator: 3,
    },
  },
  commands: {
    timeout: 30,
    allowedCommands: {
      'ls': 'List directory contents',
      'pwd': 'Print working directory',
    },
    blacklistedCommands: ['rm', 'sudo', 'su'],
  },
  context: {
    maxTokens: 4096,
    compactThreshold: 3000,
  },
  ui: {
    streaming: true,
  },
});

export const createMockTaskState = () => ({
  currentPlan: '',
  currentInstruction: '',
  planArray: [],
  stepIndex: 0,
  lastActionTaken: '',
  lastActionResult: '',
  userClarification: '',
  lastEvalDecision: '',
  iteration: 1,
  plannerRetryCount: 0,
  actionRetryCount: 0,
  evalRetryCount: 0,
});
