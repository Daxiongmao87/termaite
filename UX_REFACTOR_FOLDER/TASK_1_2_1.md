# Task 1.2.1: Implement Basic CLI Entry Point

## Overview
Create the main entry point for the CLI package using React and Ink for terminal UI rendering.

## Objective
Set up the foundational CLI application that can render React components in the terminal and handle basic command-line arguments.

## Files to Create/Modify

### 1. CLI Main Entry Point
**File**: `/packages/cli/src/main.tsx`
**Content Requirements**:
- React and Ink imports
- Command line argument parsing
- Basic render setup
- Exit handling

```typescript
#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import App from './ui/App.js';
import { CLIOptions } from './types.js';

const program = new Command();

program
  .name('termaite')
  .description('AI-powered terminal automation with multi-agent architecture')
  .version('2.0.0')
  .option('-m, --mode <mode>', 'operation mode (normal|gremlin|goblin)', 'normal')
  .option('-c, --config <path>', 'path to configuration file')
  .option('-v, --verbose', 'enable verbose logging')
  .option('--no-color', 'disable colored output')
  .option('--debug', 'enable debug mode')
  .argument('[task]', 'task description to execute');

program.action(async (task: string, options: CLIOptions) => {
  // Validate options
  if (options.mode && !['normal', 'gremlin', 'goblin'].includes(options.mode)) {
    console.error('Error: Invalid mode. Must be one of: normal, gremlin, goblin');
    process.exit(1);
  }

  // Set up graceful shutdown
  let shutdown = false;
  const handleShutdown = () => {
    if (!shutdown) {
      shutdown = true;
      console.log('\n👋 Goodbye!');
      process.exit(0);
    }
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  try {
    // Render the React/Ink application
    const { unmount, waitUntilExit } = render(
      <App 
        task={task}
        options={options}
        onExit={handleShutdown}
      />
    );

    // Handle cleanup on exit
    process.on('exit', () => {
      unmount();
    });

    // Wait for the application to finish
    await waitUntilExit();
  } catch (error) {
    console.error('Application error:', error);
    process.exit(1);
  }
});

// Handle unknown commands
program.on('command:*', (operands) => {
  console.error(`Unknown command: ${operands[0]}`);
  console.error('See --help for a list of available commands.');
  process.exit(1);
});

// Parse command line arguments
program.parseAsync(process.argv).catch((error) => {
  console.error('Command parsing error:', error);
  process.exit(1);
});
```

### 2. CLI Types Definition
**File**: `/packages/cli/src/types.ts`
**Content Requirements**:
- CLI-specific type definitions
- Option interfaces
- Component prop types

```typescript
export interface CLIOptions {
  mode: 'normal' | 'gremlin' | 'goblin';
  config?: string;
  verbose?: boolean;
  color: boolean;
  debug?: boolean;
}

export interface AppProps {
  task?: string;
  options: CLIOptions;
  onExit: () => void;
}

export interface TaskState {
  status: 'idle' | 'planning' | 'acting' | 'evaluating' | 'completed' | 'failed';
  currentAgent: 'plan' | 'action' | 'evaluation' | null;
  progress: number;
  message: string;
}

export interface StreamEvent {
  type: 'agent_start' | 'agent_thinking' | 'agent_response' | 'command_start' | 'command_output' | 'command_complete' | 'error';
  agent?: 'plan' | 'action' | 'evaluation';
  data: any;
  timestamp: number;
}

export interface UIState {
  isLoading: boolean;
  showInput: boolean;
  messages: StreamEvent[];
  currentTask: string | null;
  error: string | null;
}
```

### 3. Package.json for CLI
**File**: `/packages/cli/package.json`
**Content Requirements**:
- React and Ink dependencies
- TypeScript configuration
- Build scripts
- Binary configuration

```json
{
  "name": "@termaite/cli",
  "version": "2.0.0",
  "description": "AI-powered terminal automation CLI with React/Ink UI",
  "main": "dist/main.js",
  "bin": {
    "termaite": "dist/main.js"
  },
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "npm run build && node dist/main.js",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/**/*.{ts,tsx}",
    "lint:fix": "eslint src/**/*.{ts,tsx} --fix"
  },
  "dependencies": {
    "react": "^18.2.0",
    "ink": "^4.4.1",
    "commander": "^11.1.0",
    "@termaite/core": "workspace:*"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "typescript": "^5.3.0",
    "vitest": "^1.0.4",
    "@testing-library/react": "^14.1.2",
    "ink-testing-library": "^3.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 4. TypeScript Configuration for CLI
**File**: `/packages/cli/tsconfig.json`
**Content Requirements**:
- React/JSX support
- Module resolution for Ink
- Reference to core package

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["vitest/globals", "node"]
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "dist",
    "node_modules",
    "**/*.test.ts",
    "**/*.test.tsx"
  ],
  "references": [
    { "path": "../core" }
  ]
}
```

### 5. Vitest Configuration for CLI
**File**: `/packages/cli/vitest.config.ts`
**Content Requirements**:
- React testing support
- Ink testing setup
- Mock configurations

```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@termaite/core': resolve(__dirname, '../core/src'),
    },
  },
});
```

### 6. Test Setup File
**File**: `/packages/cli/src/test/setup.ts`
**Content Requirements**:
- Test environment setup
- Mock configurations
- Testing utilities

```typescript
import { vi } from 'vitest';

// Mock process.stdout for Ink testing
Object.defineProperty(process.stdout, 'write', {
  value: vi.fn(),
  writable: true,
});

// Mock process exit
vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
  throw new Error(`Process exit called with code: ${code}`);
});

// Global test utilities
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
};
```

### 7. Basic CLI Test
**File**: `/packages/cli/src/__tests__/main.test.ts`
**Content Requirements**:
- Basic CLI functionality tests
- Argument parsing tests
- Error handling tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI Entry Point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show help when no arguments provided', async () => {
    try {
      await execAsync('node dist/main.js --help');
    } catch (error: any) {
      expect(error.stdout).toContain('AI-powered terminal automation');
      expect(error.stdout).toContain('Usage:');
    }
  });

  it('should show version information', async () => {
    try {
      await execAsync('node dist/main.js --version');
    } catch (error: any) {
      expect(error.stdout).toContain('2.0.0');
    }
  });

  it('should handle invalid mode option', async () => {
    try {
      await execAsync('node dist/main.js --mode invalid');
    } catch (error: any) {
      expect(error.stderr).toContain('Invalid mode');
    }
  });

  it('should accept valid mode options', async () => {
    const modes = ['normal', 'gremlin', 'goblin'];
    
    for (const mode of modes) {
      try {
        // This will likely fail since we don't have a full implementation yet,
        // but it should at least parse the mode correctly
        await execAsync(`node dist/main.js --mode ${mode} "test task"`);
      } catch (error: any) {
        // Should not fail due to invalid mode
        expect(error.stderr).not.toContain('Invalid mode');
      }
    }
  });
});
```

## Implementation Steps

1. **Create main entry point**
   - Set up React and Ink rendering
   - Add command line argument parsing
   - Implement basic error handling

2. **Define CLI types**
   - Create option interfaces
   - Define component prop types
   - Add state management types

3. **Configure package.json**
   - Add React and Ink dependencies
   - Set up binary configuration
   - Add build and test scripts

4. **Set up TypeScript configuration**
   - Configure JSX support
   - Set up module resolution
   - Add package references

5. **Create test infrastructure**
   - Set up Vitest configuration
   - Create test setup file
   - Add basic CLI tests

## Validation Criteria

### ✅ CLI Entry Point Working
- [ ] `npm run build` compiles TypeScript without errors
- [ ] `node dist/main.js --help` shows help information
- [ ] `node dist/main.js --version` shows version number
- [ ] Invalid arguments show appropriate error messages

### ✅ React/Ink Integration
- [ ] React components can be rendered in terminal
- [ ] Ink render function works without errors
- [ ] Application exits gracefully
- [ ] Ctrl+C handling works correctly

### ✅ Argument Parsing
- [ ] All command line options are parsed correctly
- [ ] Mode validation works (normal/gremlin/goblin)
- [ ] Task argument is captured properly
- [ ] Invalid options show helpful error messages

### ✅ Build Configuration
- [ ] TypeScript compilation succeeds
- [ ] JSX is transformed correctly
- [ ] Binary executable is created
- [ ] Dependencies are resolved correctly

## Dependencies Required
- react (React library)
- ink (Terminal UI library)
- commander (Command line parsing)
- @types/react (React types)
- ink-testing-library (Testing utilities)

## Success Criteria
✅ **Functional CLI entry point that can render React components in the terminal and handle command line arguments correctly.**

## Notes for AI Implementation
- Test CLI with different argument combinations
- Ensure graceful shutdown on Ctrl+C
- Validate that React/Ink rendering works in terminal
- Test binary executable after build
- Verify error handling for edge cases
