# Task 1.2.2: Create Minimal App Component

## Overview
Create the main App component that serves as the root of the React/Ink application with basic layout and state management.

## Objective
Implement a minimal but functional App component that can display basic UI elements and manage application state.

## Files to Create/Modify

### 1. Main App Component
**File**: `/packages/cli/src/ui/App.tsx`
**Content Requirements**:
- React functional component with hooks
- Basic layout structure
- State management for app lifecycle
- Props interface implementation

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import { AppProps, TaskState, UIState } from '../types.js';

const App: React.FC<AppProps> = ({ task, options, onExit }) => {
  const [uiState, setUIState] = useState<UIState>({
    isLoading: false,
    showInput: true,
    messages: [],
    currentTask: task || null,
    error: null,
  });

  const [taskState, setTaskState] = useState<TaskState>({
    status: 'idle',
    currentAgent: null,
    progress: 0,
    message: 'Ready to start...',
  });

  // Initialize the application
  useEffect(() => {
    if (task) {
      setTaskState(prev => ({
        ...prev,
        status: 'planning',
        message: `Planning task: ${task}`,
      }));
    }
  }, [task]);

  // Handle Ctrl+C gracefully
  useEffect(() => {
    const handleExit = () => {
      onExit();
    };

    process.on('SIGINT', handleExit);
    return () => {
      process.removeListener('SIGINT', handleExit);
    };
  }, [onExit]);

  const renderHeader = () => (
    <Box borderStyle="single" borderColor="blue" paddingX={1}>
      <Box flexDirection="column">
        <Text bold color="blue">🤖 term.ai.te v2.0.0</Text>
        <Text dimColor>AI-powered terminal automation</Text>
        <Text dimColor>Mode: {options.mode} | Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );

  const renderStatus = () => (
    <Box borderStyle="single" borderColor="green" paddingX={1} marginY={1}>
      <Box flexDirection="column">
        <Text bold color="green">Status</Text>
        <Text>Current Status: <Text color="yellow">{taskState.status}</Text></Text>
        {taskState.currentAgent && (
          <Text>Active Agent: <Text color="cyan">{taskState.currentAgent}</Text></Text>
        )}
        <Text>Progress: <Text color="magenta">{taskState.progress}%</Text></Text>
        <Text>{taskState.message}</Text>
      </Box>
    </Box>
  );

  const renderContent = () => {
    if (uiState.error) {
      return (
        <Box borderStyle="single" borderColor="red" paddingX={1}>
          <Box flexDirection="column">
            <Text bold color="red">❌ Error</Text>
            <Text color="red">{uiState.error}</Text>
          </Box>
        </Box>
      );
    }

    if (!task) {
      return (
        <Box borderStyle="single" borderColor="yellow" paddingX={1}>
          <Box flexDirection="column">
            <Text bold color="yellow">💡 Welcome</Text>
            <Text>No task specified. Please provide a task description:</Text>
            <Text dimColor>Example: termaite "List all files in the current directory"</Text>
          </Box>
        </Box>
      );
    }

    return (
      <Box borderStyle="single" borderColor="cyan" paddingX={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">📋 Current Task</Text>
          <Text wrap="wrap">{task}</Text>
          <Newline />
          {taskState.status === 'idle' && (
            <Text dimColor>Press Enter to start execution...</Text>
          )}
          {taskState.status !== 'idle' && taskState.status !== 'completed' && (
            <Text color="yellow">⏳ Working on your task...</Text>
          )}
          {taskState.status === 'completed' && (
            <Text color="green">✅ Task completed successfully!</Text>
          )}
        </Box>
      </Box>
    );
  };

  const renderFooter = () => (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Box justifyContent="space-between">
        <Text dimColor>term.ai.te - AI Terminal Automation</Text>
        <Text dimColor>{new Date().toLocaleTimeString()}</Text>
      </Box>
    </Box>
  );

  return (
    <Box flexDirection="column" minHeight={20}>
      {renderHeader()}
      {renderStatus()}
      {renderContent()}
      <Box flexGrow={1} />
      {renderFooter()}
    </Box>
  );
};

export default App;
```

### 2. Basic Theme Configuration
**File**: `/packages/cli/src/ui/theme.ts`
**Content Requirements**:
- Color palette definition
- Component styling constants
- Theme interface

```typescript
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    muted: string;
    text: string;
    background: string;
  };
  borders: {
    style: 'single' | 'double' | 'round' | 'bold';
    colors: {
      default: string;
      active: string;
      inactive: string;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
  };
}

export const defaultTheme: Theme = {
  colors: {
    primary: 'blue',
    secondary: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    muted: 'gray',
    text: 'white',
    background: 'black',
  },
  borders: {
    style: 'single',
    colors: {
      default: 'gray',
      active: 'blue',
      inactive: 'dim',
    },
  },
  spacing: {
    small: 1,
    medium: 2,
    large: 3,
  },
};

export const getThemeColor = (colorName: keyof Theme['colors']): string => {
  return defaultTheme.colors[colorName];
};

export const getBorderStyle = (): 'single' | 'double' | 'round' | 'bold' => {
  return defaultTheme.borders.style;
};
```

### 3. Component Index File
**File**: `/packages/cli/src/ui/index.ts`
**Content Requirements**:
- Export main components
- Export theme utilities
- Export type definitions

```typescript
export { default as App } from './App.js';
export * from './theme.js';
export * from '../types.js';
```

### 4. App Component Test
**File**: `/packages/cli/src/ui/__tests__/App.test.tsx`
**Content Requirements**:
- Component rendering tests
- Props validation tests
- State management tests

```typescript
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import App from '../App.js';
import { CLIOptions } from '../../types.js';

const defaultOptions: CLIOptions = {
  mode: 'normal',
  color: true,
};

describe('App Component', () => {
  it('should render welcome message when no task provided', () => {
    const mockOnExit = vi.fn();
    const { lastFrame } = render(
      <App options={defaultOptions} onExit={mockOnExit} />
    );

    expect(lastFrame()).toContain('term.ai.te v2.0.0');
    expect(lastFrame()).toContain('Welcome');
    expect(lastFrame()).toContain('No task specified');
  });

  it('should render task when provided', () => {
    const mockOnExit = vi.fn();
    const testTask = 'Test task description';
    
    const { lastFrame } = render(
      <App 
        task={testTask}
        options={defaultOptions} 
        onExit={mockOnExit} 
      />
    );

    expect(lastFrame()).toContain('Current Task');
    expect(lastFrame()).toContain(testTask);
  });

  it('should display correct mode in header', () => {
    const mockOnExit = vi.fn();
    const gremlinOptions: CLIOptions = {
      mode: 'gremlin',
      color: true,
    };
    
    const { lastFrame } = render(
      <App 
        options={gremlinOptions} 
        onExit={mockOnExit} 
      />
    );

    expect(lastFrame()).toContain('Mode: gremlin');
  });

  it('should show initial status as idle', () => {
    const mockOnExit = vi.fn();
    
    const { lastFrame } = render(
      <App 
        options={defaultOptions} 
        onExit={mockOnExit} 
      />
    );

    expect(lastFrame()).toContain('Current Status');
    expect(lastFrame()).toContain('idle');
  });

  it('should handle task initialization', () => {
    const mockOnExit = vi.fn();
    const testTask = 'Initialize test task';
    
    const { lastFrame } = render(
      <App 
        task={testTask}
        options={defaultOptions} 
        onExit={mockOnExit} 
      />
    );

    // Should show the task in the content area
    expect(lastFrame()).toContain(testTask);
    expect(lastFrame()).toContain('Current Task');
  });

  it('should display footer with timestamp', () => {
    const mockOnExit = vi.fn();
    
    const { lastFrame } = render(
      <App 
        options={defaultOptions} 
        onExit={mockOnExit} 
      />
    );

    expect(lastFrame()).toContain('term.ai.te - AI Terminal Automation');
    // Should contain time format (though exact time will vary)
    expect(lastFrame()).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });
});
```

### 5. Theme Test
**File**: `/packages/cli/src/ui/__tests__/theme.test.ts`
**Content Requirements**:
- Theme configuration tests
- Color utility tests
- Theme validation tests

```typescript
import { describe, it, expect } from 'vitest';
import { defaultTheme, getThemeColor, getBorderStyle } from '../theme.js';

describe('Theme Configuration', () => {
  it('should have all required color properties', () => {
    const requiredColors = [
      'primary', 'secondary', 'success', 'warning', 
      'error', 'info', 'muted', 'text', 'background'
    ];

    requiredColors.forEach(color => {
      expect(defaultTheme.colors).toHaveProperty(color);
      expect(typeof defaultTheme.colors[color as keyof typeof defaultTheme.colors]).toBe('string');
    });
  });

  it('should have border configuration', () => {
    expect(defaultTheme.borders).toBeDefined();
    expect(defaultTheme.borders.style).toBeDefined();
    expect(defaultTheme.borders.colors).toBeDefined();
    expect(defaultTheme.borders.colors.default).toBeDefined();
    expect(defaultTheme.borders.colors.active).toBeDefined();
    expect(defaultTheme.borders.colors.inactive).toBeDefined();
  });

  it('should have spacing configuration', () => {
    expect(defaultTheme.spacing).toBeDefined();
    expect(typeof defaultTheme.spacing.small).toBe('number');
    expect(typeof defaultTheme.spacing.medium).toBe('number');
    expect(typeof defaultTheme.spacing.large).toBe('number');
  });

  it('should return correct colors from getThemeColor', () => {
    expect(getThemeColor('primary')).toBe('blue');
    expect(getThemeColor('success')).toBe('green');
    expect(getThemeColor('error')).toBe('red');
    expect(getThemeColor('warning')).toBe('yellow');
  });

  it('should return correct border style', () => {
    expect(getBorderStyle()).toBe('single');
  });
});
```

## Implementation Steps

1. **Create main App component**
   - Implement React functional component with hooks
   - Add basic layout with header, content, and footer
   - Set up state management for UI and task state

2. **Implement theme system**
   - Define color palette and styling constants
   - Create theme interface and utilities
   - Add theme helper functions

3. **Set up component structure**
   - Create component index file
   - Organize exports and imports
   - Set up proper module resolution

4. **Create comprehensive tests**
   - Test component rendering with different props
   - Validate state management
   - Test theme configuration

5. **Validate component behavior**
   - Test with different task inputs
   - Verify mode display
   - Ensure proper exit handling

## Validation Criteria

### ✅ Component Rendering
- [ ] App component renders without errors
- [ ] Header displays correct information
- [ ] Status section shows current state
- [ ] Content area adapts to task presence
- [ ] Footer displays timestamp

### ✅ State Management
- [ ] UI state updates correctly
- [ ] Task state changes appropriately
- [ ] Component re-renders on state changes
- [ ] Exit handling works properly

### ✅ Theme Integration
- [ ] Colors apply correctly to components
- [ ] Border styles render properly
- [ ] Spacing is consistent
- [ ] Theme utilities work as expected

### ✅ Testing Coverage
- [ ] All component behaviors are tested
- [ ] Props variations are covered
- [ ] State changes are validated
- [ ] Theme configuration is tested

## Dependencies Required
- ink (Box, Text, Newline components)
- react (hooks and component system)
- ink-testing-library (testing utilities)

## Success Criteria
✅ **Functional App component that displays a clean, organized terminal UI with proper state management and theme support.**

## Notes for AI Implementation
- Ensure all Ink components are used correctly
- Test component with various prop combinations
- Validate that layout is responsive to terminal size
- Check that colors and borders render properly
- Verify state updates trigger re-renders correctly
