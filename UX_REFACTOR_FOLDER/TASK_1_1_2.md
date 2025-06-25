# Task 1.1.2: Create CLI Package Structure

## Overview
Create the React/Ink CLI package structure with TypeScript configuration and basic setup.

## Objective
Set up the packages/cli directory with all necessary configuration files and basic structure for the React/Ink-based terminal UI.

## Prerequisites
- Task 1.1.1 (Create Monorepo Structure) must be completed
- Root workspace configuration must be functional

## Files to Create/Modify

### 1. CLI Package Configuration
**File**: `/packages/cli/package.json`
**Content Requirements**:
- React/Ink dependencies
- TypeScript configuration
- Build and development scripts
- Proper module exports

```json
{
  "name": "@termaite/cli",
  "version": "2.0.0",
  "description": "Rich terminal UI for term.ai.te",
  "main": "dist/cli.js",
  "type": "module",
  "bin": {
    "termaite": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc && node ../../esbuild.config.js",
    "dev": "nodemon --watch src --ext ts,tsx --exec \"npm run build\"",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "ink": "^4.4.1",
    "commander": "^11.0.0",
    "chalk": "^5.3.0",
    "ws": "^8.14.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/ws": "^8.5.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "ink-testing-library": "^3.0.0"
  },
  "peerDependencies": {
    "@termaite/core": "2.0.0"
  }
}
```

### 2. TypeScript Configuration
**File**: `/packages/cli/tsconfig.json`
**Content Requirements**:
- CLI-specific TypeScript settings
- React/JSX configuration
- Module resolution for monorepo

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "rootDir": "./src",
    "outDir": "./dist",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"],
      "@termaite/core": ["../../core/src"]
    }
  },
  "include": [
    "src/**/*"
  ],
  "exclude": [
    "dist",
    "node_modules",
    "**/*.test.*"
  ],
  "references": [
    { "path": "../core" }
  ]
}
```

### 3. Test Configuration
**File**: `/packages/cli/vitest.config.ts`
**Content Requirements**:
- Vitest configuration for testing
- React testing setup
- Mock configurations

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@termaite/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
```

### 4. Main Entry Point
**File**: `/packages/cli/src/main.tsx`
**Content Requirements**:
- CLI entry point with React/Ink
- Command line argument parsing
- Basic error handling
- App component rendering

```typescript
#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { Command } from 'commander';
import { App } from './ui/App.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CLIOptions {
  debug?: boolean;
  config?: string;
  agentic?: boolean;
}

function createProgram() {
  const program = new Command();
  
  program
    .name('termaite')
    .description('AI-powered terminal assistant with rich UI')
    .version('2.0.0')
    .option('-d, --debug', 'enable debug mode')
    .option('-c, --config <path>', 'path to configuration file')
    .option('-a, --agentic', 'use agentic mode by default')
    .argument('[task]', 'task to execute');

  return program;
}

async function main() {
  try {
    const program = createProgram();
    program.parse();
    
    const options = program.opts<CLIOptions>();
    const task = program.args[0];
    
    // If task is provided, run in non-interactive mode
    if (task) {
      // TODO: Implement non-interactive mode
      console.log(`Non-interactive mode not yet implemented. Task: ${task}`);
      process.exit(0);
    }
    
    // Interactive mode with React/Ink
    render(
      <App 
        debug={options.debug || false}
        configPath={options.config}
        defaultAgentic={options.agentic || false}
      />
    );
    
  } catch (error) {
    console.error('Failed to start termaite:', error);
    process.exit(1);
  }
}

main();
```

### 5. App Component Placeholder
**File**: `/packages/cli/src/ui/App.tsx`
**Content Requirements**:
- Basic React functional component
- Props interface for configuration
- Placeholder layout structure
- Error boundary setup

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';

interface AppProps {
  debug?: boolean;
  configPath?: string;
  defaultAgentic?: boolean;
}

export const App: React.FC<AppProps> = ({ 
  debug = false, 
  configPath, 
  defaultAgentic = false 
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Initialize core connection
    setIsInitialized(true);
  }, []);

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error}>Error: {error}</Text>
        <Text color={theme.colors.dim}>Press Ctrl+C to exit</Text>
      </Box>
    );
  }

  if (!isInitialized) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.info}>Initializing term.ai.te...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box borderStyle="single" borderColor={theme.colors.border} padding={1}>
        <Text color={theme.colors.primary} bold>
          term.ai.te v2.0 - Rich Terminal UI
        </Text>
      </Box>
      
      <Box flexGrow={1} padding={1}>
        <Text color={theme.colors.dim}>
          CLI package structure created successfully!
          {debug && <Text color={theme.colors.warning}> [DEBUG MODE]</Text>}
        </Text>
      </Box>
      
      <Box borderStyle="single" borderColor={theme.colors.border} padding={1}>
        <Text color={theme.colors.dim}>
          Ready for development. Press Ctrl+C to exit.
        </Text>
      </Box>
    </Box>
  );
};
```

### 6. Basic Theme
**File**: `/packages/cli/src/ui/theme.ts`
**Content Requirements**:
- Color palette definition
- Theme interface
- Extensible theme structure
- Default theme implementation

```typescript
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    dim: string;
    border: string;
    background: string;
    text: string;
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
  borders: {
    style: 'single' | 'double' | 'round' | 'bold';
  };
}

export const theme: Theme = {
  colors: {
    primary: '#00D2FF',
    secondary: '#0080FF',
    accent: '#FF6B6B',
    success: '#51CF66',
    warning: '#FFD43B',
    error: '#FF6B6B',
    info: '#74C0FC',
    dim: '#868E96',
    border: '#495057',
    background: '#212529',
    text: '#F8F9FA',
  },
  spacing: {
    small: 1,
    medium: 2,
    large: 4,
  },
  borders: {
    style: 'single',
  },
};

// Theme utilities
export const getThemeColor = (colorName: keyof Theme['colors']) => {
  return theme.colors[colorName];
};

export const applyTheme = (customTheme: Partial<Theme>): Theme => {
  return {
    ...theme,
    ...customTheme,
    colors: {
      ...theme.colors,
      ...customTheme.colors,
    },
    spacing: {
      ...theme.spacing,
      ...customTheme.spacing,
    },
    borders: {
      ...theme.borders,
      ...customTheme.borders,
    },
  };
};
```

### 7. Test Setup
**File**: `/packages/cli/src/test-setup.ts`
**Content Requirements**:
- Test environment configuration
- Mock setup for dependencies
- Global test utilities

```typescript
import { vi } from 'vitest';

// Mock WebSocket for testing
vi.mock('ws', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  })),
}));

// Mock commander for testing
vi.mock('commander', () => ({
  Command: vi.fn().mockImplementation(() => ({
    name: vi.fn().mockReturnThis(),
    description: vi.fn().mockReturnThis(),
    version: vi.fn().mockReturnThis(),
    option: vi.fn().mockReturnThis(),
    argument: vi.fn().mockReturnThis(),
    parse: vi.fn(),
    opts: vi.fn().mockReturnValue({}),
    args: [],
  })),
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
```

### 8. Directory Structure
Create the following directories:
```
packages/cli/src/
├── ui/
│   ├── components/
│   ├── hooks/
│   └── utils/
├── communication/
├── types/
└── __tests__/
```

**Files to create for directory structure**:
- `/packages/cli/src/ui/components/index.ts`
- `/packages/cli/src/ui/hooks/index.ts`
- `/packages/cli/src/ui/utils/index.ts`
- `/packages/cli/src/communication/index.ts`
- `/packages/cli/src/types/index.ts`

Each index.ts should contain:
```typescript
// Export placeholder - will be populated in subsequent tasks
export {};
```

## Dependencies to Install
```bash
cd packages/cli
npm install react ink commander chalk ws
npm install --save-dev @types/react @types/ws vitest @testing-library/react ink-testing-library
```

## Validation Criteria

### 1. Package Structure
- [ ] packages/cli directory exists with proper structure
- [ ] package.json is valid and includes all required dependencies
- [ ] TypeScript configuration compiles without errors
- [ ] All directory structures are created

### 2. Build System
- [ ] `npm run build` completes successfully
- [ ] `npm run type-check` passes without errors
- [ ] Build output is generated in dist/ directory
- [ ] Binary entry point is executable

### 3. Development Environment
- [ ] `npm run dev` starts development mode
- [ ] File watching works correctly
- [ ] Hot reload functionality works
- [ ] Tests can be run with `npm test`

### 4. Basic Functionality
- [ ] CLI starts without errors
- [ ] Basic UI renders in terminal
- [ ] Command line arguments are parsed correctly
- [ ] Theme system is functional

## Success Criteria
- CLI package structure is complete and functional
- TypeScript compilation works without errors
- Basic React/Ink app renders successfully
- Development environment is operational
- All dependencies are properly installed

## Next Task
After completion, proceed to **Task 1.1.3: Create Core Package Structure**

## Notes
- Ensure React/Ink versions are compatible
- Test CLI functionality in terminal
- Verify monorepo workspace integration
- Document any package-specific configurations
