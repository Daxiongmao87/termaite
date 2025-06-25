# Task 1.2.3: Implement Default Theme

## Overview
Expand the theme system with comprehensive styling support, theme context, and advanced theme utilities.

## Objective
Create a robust theme system that provides consistent styling across all UI components with support for dynamic theme switching.

## Files to Create/Modify

### 1. Enhanced Theme Interface and Configuration
**File**: `/packages/cli/src/ui/theme.ts`
**Content Requirements** (Update existing file):
- Extended theme interface
- Multiple theme variants
- Theme context provider
- Theme hooks

```typescript
import React, { createContext, useContext, ReactNode } from 'react';

export interface Theme {
  name: string;
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
    accent: string;
    highlight: string;
    border: string;
  };
  borders: {
    style: 'single' | 'double' | 'round' | 'bold';
    colors: {
      default: string;
      active: string;
      inactive: string;
      focus: string;
    };
  };
  spacing: {
    none: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    sizes: {
      xs: number;
      sm: number;
      md: number;
      lg: number;
      xl: number;
    };
  };
  components: {
    header: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    status: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    content: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    footer: {
      borderColor: string;
      backgroundColor?: string;
      textColor: string;
    };
    agent: {
      plan: string;
      action: string;
      evaluation: string;
    };
  };
}

export const defaultTheme: Theme = {
  name: 'default',
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
    accent: 'magenta',
    highlight: 'yellowBright',
    border: 'gray',
  },
  borders: {
    style: 'single',
    colors: {
      default: 'gray',
      active: 'blue',
      inactive: 'dim',
      focus: 'cyan',
    },
  },
  spacing: {
    none: 0,
    xs: 1,
    sm: 2,
    md: 3,
    lg: 4,
    xl: 5,
  },
  typography: {
    sizes: {
      xs: 8,
      sm: 10,
      md: 12,
      lg: 14,
      xl: 16,
    },
  },
  components: {
    header: {
      borderColor: 'blue',
      textColor: 'blue',
    },
    status: {
      borderColor: 'green',
      textColor: 'green',
    },
    content: {
      borderColor: 'cyan',
      textColor: 'white',
    },
    footer: {
      borderColor: 'gray',
      textColor: 'gray',
    },
    agent: {
      plan: 'blue',
      action: 'yellow',
      evaluation: 'green',
    },
  },
};

export const compactTheme: Theme = {
  ...defaultTheme,
  name: 'compact',
  spacing: {
    none: 0,
    xs: 0,
    sm: 1,
    md: 1,
    lg: 2,
    xl: 2,
  },
  borders: {
    ...defaultTheme.borders,
    style: 'round',
  },
};

export const minimalTheme: Theme = {
  ...defaultTheme,
  name: 'minimal',
  colors: {
    ...defaultTheme.colors,
    primary: 'white',
    secondary: 'gray',
    muted: 'dim',
  },
  borders: {
    ...defaultTheme.borders,
    style: 'single',
    colors: {
      default: 'dim',
      active: 'white',
      inactive: 'dim',
      focus: 'gray',
    },
  },
};

// Theme Context
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeName: string;
  switchTheme: (themeName: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Available themes
export const themes: Record<string, Theme> = {
  default: defaultTheme,
  compact: compactTheme,
  minimal: minimalTheme,
};

// Theme Provider Component
interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  initialTheme = 'default' 
}) => {
  const [currentTheme, setCurrentTheme] = React.useState<Theme>(
    themes[initialTheme] || defaultTheme
  );
  const [themeName, setThemeName] = React.useState<string>(initialTheme);

  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    setThemeName(theme.name);
  };

  const switchTheme = (name: string) => {
    const theme = themes[name];
    if (theme) {
      setTheme(theme);
    }
  };

  const value: ThemeContextType = {
    theme: currentTheme,
    setTheme,
    themeName,
    switchTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Theme Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Theme Utility Functions
export const getThemeColor = (theme: Theme, colorName: keyof Theme['colors']): string => {
  return theme.colors[colorName];
};

export const getBorderStyle = (theme: Theme): 'single' | 'double' | 'round' | 'bold' => {
  return theme.borders.style;
};

export const getBorderColor = (theme: Theme, type: keyof Theme['borders']['colors']): string => {
  return theme.borders.colors[type];
};

export const getSpacing = (theme: Theme, size: keyof Theme['spacing']): number => {
  return theme.spacing[size];
};

export const getComponentStyle = (theme: Theme, component: keyof Theme['components']) => {
  return theme.components[component];
};

export const getAgentColor = (theme: Theme, agent: keyof Theme['components']['agent']): string => {
  return theme.components.agent[agent];
};

// Style Builder Utilities
export interface StyleProps {
  color?: keyof Theme['colors'];
  borderColor?: keyof Theme['borders']['colors'];
  spacing?: keyof Theme['spacing'];
  bold?: boolean;
  dim?: boolean;
}

export const buildStyle = (theme: Theme, props: StyleProps) => {
  const style: any = {};
  
  if (props.color) {
    style.color = getThemeColor(theme, props.color);
  }
  
  if (props.borderColor) {
    style.borderColor = getBorderColor(theme, props.borderColor);
  }
  
  if (props.spacing) {
    style.padding = getSpacing(theme, props.spacing);
  }
  
  if (props.bold) {
    style.bold = true;
  }
  
  if (props.dim) {
    style.dimColor = true;
  }
  
  return style;
};
```

### 2. Theme-Aware Component Utilities
**File**: `/packages/cli/src/ui/utils/styled.ts`
**Content Requirements**:
- Styled component utilities
- Theme-aware wrappers
- Common component patterns

```typescript
import React from 'react';
import { Box, Text, BoxProps, TextProps } from 'ink';
import { useTheme, StyleProps, buildStyle } from '../theme.js';

// Styled Box Component
interface StyledBoxProps extends BoxProps, StyleProps {
  component?: keyof import('../theme.js').Theme['components'];
}

export const StyledBox: React.FC<StyledBoxProps> = ({ 
  component, 
  color, 
  borderColor, 
  spacing,
  children, 
  ...boxProps 
}) => {
  const { theme } = useTheme();
  
  let componentStyle = {};
  if (component) {
    const compStyle = theme.components[component];
    componentStyle = {
      borderColor: compStyle.borderColor,
      ...compStyle.backgroundColor && { backgroundColor: compStyle.backgroundColor },
    };
  }
  
  const customStyle = buildStyle(theme, { color, borderColor, spacing });
  
  return (
    <Box 
      {...boxProps} 
      {...componentStyle}
      {...customStyle}
    >
      {children}
    </Box>
  );
};

// Styled Text Component
interface StyledTextProps extends TextProps, StyleProps {
  agent?: keyof import('../theme.js').Theme['components']['agent'];
}

export const StyledText: React.FC<StyledTextProps> = ({ 
  agent,
  color, 
  bold, 
  dim,
  children, 
  ...textProps 
}) => {
  const { theme } = useTheme();
  
  let agentColor;
  if (agent) {
    agentColor = theme.components.agent[agent];
  }
  
  const style = buildStyle(theme, { color, bold, dim });
  
  return (
    <Text 
      {...textProps}
      color={agentColor || style.color}
      bold={style.bold}
      dimColor={style.dimColor}
    >
      {children}
    </Text>
  );
};

// Common Layout Components
export const HeaderBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledBox 
    component="header" 
    borderStyle="single" 
    paddingX={1}
  >
    {children}
  </StyledBox>
);

export const StatusBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledBox 
    component="status" 
    borderStyle="single" 
    paddingX={1} 
    marginY={1}
  >
    {children}
  </StyledBox>
);

export const ContentBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledBox 
    component="content" 
    borderStyle="single" 
    paddingX={1}
  >
    {children}
  </StyledBox>
);

export const FooterBox: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledBox 
    component="footer" 
    borderStyle="single" 
    paddingX={1}
  >
    {children}
  </StyledBox>
);

// Agent-specific Text Components
export const PlanText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledText agent="plan" bold>{children}</StyledText>
);

export const ActionText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledText agent="action" bold>{children}</StyledText>
);

export const EvaluationText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledText agent="evaluation" bold>{children}</StyledText>
);
```

### 3. Updated App Component with Theme Support
**File**: `/packages/cli/src/ui/App.tsx`
**Content Requirements** (Update existing file):
- Theme provider integration
- Styled components usage
- Theme-aware rendering

```typescript
import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import { AppProps, TaskState, UIState } from '../types.js';
import { ThemeProvider } from './theme.js';
import { 
  HeaderBox, 
  StatusBox, 
  ContentBox, 
  FooterBox,
  StyledText,
  PlanText,
  ActionText,
  EvaluationText
} from './utils/styled.js';

const AppContent: React.FC<AppProps> = ({ task, options, onExit }) => {
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
    <HeaderBox>
      <Box flexDirection="column">
        <StyledText color="primary" bold>🤖 term.ai.te v2.0.0</StyledText>
        <StyledText dim>AI-powered terminal automation</StyledText>
        <StyledText dim>Mode: {options.mode} | Press Ctrl+C to exit</StyledText>
      </Box>
    </HeaderBox>
  );

  const renderStatus = () => (
    <StatusBox>
      <Box flexDirection="column">
        <StyledText color="success" bold>Status</StyledText>
        <Text>Current Status: <StyledText color="warning">{taskState.status}</StyledText></Text>
        {taskState.currentAgent && (
          <Text>Active Agent: {
            taskState.currentAgent === 'plan' ? <PlanText>{taskState.currentAgent}</PlanText> :
            taskState.currentAgent === 'action' ? <ActionText>{taskState.currentAgent}</ActionText> :
            <EvaluationText>{taskState.currentAgent}</EvaluationText>
          }</Text>
        )}
        <Text>Progress: <StyledText color="accent">{taskState.progress}%</StyledText></Text>
        <Text>{taskState.message}</Text>
      </Box>
    </StatusBox>
  );

  const renderContent = () => {
    if (uiState.error) {
      return (
        <ContentBox>
          <Box flexDirection="column">
            <StyledText color="error" bold>❌ Error</StyledText>
            <StyledText color="error">{uiState.error}</StyledText>
          </Box>
        </ContentBox>
      );
    }

    if (!task) {
      return (
        <ContentBox>
          <Box flexDirection="column">
            <StyledText color="warning" bold>💡 Welcome</StyledText>
            <Text>No task specified. Please provide a task description:</Text>
            <StyledText dim>Example: termaite "List all files in the current directory"</StyledText>
          </Box>
        </ContentBox>
      );
    }

    return (
      <ContentBox>
        <Box flexDirection="column">
          <StyledText color="info" bold>📋 Current Task</StyledText>
          <Text wrap="wrap">{task}</Text>
          <Newline />
          {taskState.status === 'idle' && (
            <StyledText dim>Press Enter to start execution...</StyledText>
          )}
          {taskState.status !== 'idle' && taskState.status !== 'completed' && (
            <StyledText color="warning">⏳ Working on your task...</StyledText>
          )}
          {taskState.status === 'completed' && (
            <StyledText color="success">✅ Task completed successfully!</StyledText>
          )}
        </Box>
      </ContentBox>
    );
  };

  const renderFooter = () => (
    <FooterBox>
      <Box justifyContent="space-between">
        <StyledText color="muted">term.ai.te - AI Terminal Automation</StyledText>
        <StyledText color="muted">{new Date().toLocaleTimeString()}</StyledText>
      </Box>
    </FooterBox>
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

const App: React.FC<AppProps> = (props) => {
  return (
    <ThemeProvider initialTheme="default">
      <AppContent {...props} />
    </ThemeProvider>
  );
};

export default App;
```

### 4. Theme Tests
**File**: `/packages/cli/src/ui/__tests__/theme.test.ts`
**Content Requirements** (Update existing file):
- Extended theme testing
- Context provider tests
- Utility function tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { 
  defaultTheme, 
  compactTheme, 
  minimalTheme,
  themes,
  getThemeColor, 
  getBorderStyle,
  getBorderColor,
  getSpacing,
  getComponentStyle,
  getAgentColor,
  buildStyle,
  ThemeProvider,
  useTheme
} from '../theme.js';

describe('Enhanced Theme Configuration', () => {
  it('should have all required themes', () => {
    expect(themes.default).toBeDefined();
    expect(themes.compact).toBeDefined();
    expect(themes.minimal).toBeDefined();
  });

  it('should have extended color properties', () => {
    const requiredColors = [
      'primary', 'secondary', 'success', 'warning', 
      'error', 'info', 'muted', 'text', 'background',
      'accent', 'highlight', 'border'
    ];

    requiredColors.forEach(color => {
      expect(defaultTheme.colors).toHaveProperty(color);
      expect(typeof defaultTheme.colors[color as keyof typeof defaultTheme.colors]).toBe('string');
    });
  });

  it('should have component-specific styling', () => {
    expect(defaultTheme.components.header).toBeDefined();
    expect(defaultTheme.components.status).toBeDefined();
    expect(defaultTheme.components.content).toBeDefined();
    expect(defaultTheme.components.footer).toBeDefined();
    expect(defaultTheme.components.agent).toBeDefined();
  });

  it('should have extended spacing options', () => {
    const spacingKeys = ['none', 'xs', 'sm', 'md', 'lg', 'xl'];
    spacingKeys.forEach(key => {
      expect(defaultTheme.spacing).toHaveProperty(key);
      expect(typeof defaultTheme.spacing[key as keyof typeof defaultTheme.spacing]).toBe('number');
    });
  });

  it('should return correct utility values', () => {
    expect(getThemeColor(defaultTheme, 'primary')).toBe('blue');
    expect(getBorderStyle(defaultTheme)).toBe('single');
    expect(getBorderColor(defaultTheme, 'active')).toBe('blue');
    expect(getSpacing(defaultTheme, 'md')).toBe(3);
    expect(getAgentColor(defaultTheme, 'plan')).toBe('blue');
  });

  it('should build styles correctly', () => {
    const style = buildStyle(defaultTheme, {
      color: 'primary',
      borderColor: 'active',
      spacing: 'md',
      bold: true,
      dim: false
    });

    expect(style.color).toBe('blue');
    expect(style.borderColor).toBe('blue');
    expect(style.padding).toBe(3);
    expect(style.bold).toBe(true);
  });

  it('should have consistent theme names', () => {
    expect(defaultTheme.name).toBe('default');
    expect(compactTheme.name).toBe('compact');
    expect(minimalTheme.name).toBe('minimal');
  });
});

// Test component for theme context
const TestThemeComponent: React.FC = () => {
  const { theme, themeName, switchTheme } = useTheme();
  
  return React.createElement('text', {}, 
    `Current theme: ${themeName}, Color: ${theme.colors.primary}`
  );
};

describe('Theme Provider and Context', () => {
  it('should provide theme context', () => {
    const { lastFrame } = render(
      React.createElement(ThemeProvider, { initialTheme: 'default' },
        React.createElement(TestThemeComponent)
      )
    );

    expect(lastFrame()).toContain('Current theme: default');
    expect(lastFrame()).toContain('Color: blue');
  });

  it('should handle theme switching', () => {
    const { lastFrame, rerender } = render(
      React.createElement(ThemeProvider, { initialTheme: 'minimal' },
        React.createElement(TestThemeComponent)
      )
    );

    expect(lastFrame()).toContain('Current theme: minimal');
    expect(lastFrame()).toContain('Color: white');
  });
});
```

## Implementation Steps

1. **Expand theme interface**
   - Add comprehensive color palette
   - Include component-specific styles
   - Add typography and spacing scales

2. **Create theme variants**
   - Implement default, compact, and minimal themes
   - Ensure consistency across themes
   - Add theme utility functions

3. **Build theme context system**
   - Create ThemeProvider component
   - Implement useTheme hook
   - Add theme switching capability

4. **Create styled components**
   - Build theme-aware component wrappers
   - Create common layout components
   - Add agent-specific styling

5. **Update App component**
   - Integrate ThemeProvider
   - Use styled components
   - Apply theme-aware rendering

## Validation Criteria

### ✅ Theme System
- [ ] Multiple themes are available and switchable
- [ ] Theme context provides access to all theme values
- [ ] Theme utilities return correct values
- [ ] Component styles apply consistently

### ✅ Styled Components
- [ ] Styled components render with correct theming
- [ ] Agent-specific colors apply correctly
- [ ] Layout components maintain consistent spacing
- [ ] Theme changes update components immediately

### ✅ Theme Context
- [ ] ThemeProvider initializes with correct theme
- [ ] useTheme hook provides access to theme data
- [ ] Theme switching works without errors
- [ ] Context errors are handled properly

### ✅ Testing Coverage
- [ ] All theme utilities are tested
- [ ] Component styling is validated
- [ ] Theme context behavior is tested
- [ ] Edge cases are handled

## Dependencies Required
- react (context and hooks)
- ink (UI components)

## Success Criteria
✅ **Comprehensive theme system that provides consistent styling across all components with support for multiple themes and dynamic switching.**

## Notes for AI Implementation
- Test theme switching thoroughly
- Ensure all components respect theme values
- Validate that styled components work correctly
- Check that theme context is properly typed
- Test theme utilities with different inputs
