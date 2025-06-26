import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../ThemeProvider.js';
import { defaultTheme, compactTheme, themes } from '../theme.js';

// Test component that uses the theme
const TestComponent: React.FC = () => {
  const { theme, themeName, switchTheme } = useTheme();
  
  return (
    <>
      <div>Theme: {theme.name}</div>
      <div>Primary Color: {theme.colors.primary}</div>
      <div>Current: {themeName}</div>
      <button onClick={() => switchTheme('compact')}>Switch to Compact</button>
    </>
  );
};

describe('ThemeProvider', () => {
  it('should provide default theme by default', () => {
    const { lastFrame } = render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(lastFrame()).toContain('Theme: default');
    expect(lastFrame()).toContain('Primary Color: blue');
    expect(lastFrame()).toContain('Current: default');
  });

  it('should provide initial theme when specified', () => {
    const { lastFrame } = render(
      <ThemeProvider initialTheme="compact">
        <TestComponent />
      </ThemeProvider>
    );

    expect(lastFrame()).toContain('Theme: compact');
    expect(lastFrame()).toContain('Current: compact');
  });

  it('should throw error when useTheme is used outside provider', () => {
    // Mock console.error to prevent test output spam
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleSpy.mockRestore();
  });

  it('should switch themes correctly', () => {
    let themeContext: any;
    
    const TestThemeConsumer: React.FC = () => {
      themeContext = useTheme();
      return <div>Test</div>;
    };

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    expect(themeContext.theme.name).toBe('default');
    expect(themeContext.themeName).toBe('default');

    // Switch theme
    themeContext.switchTheme('compact');
    expect(themeContext.theme.name).toBe('compact');
    expect(themeContext.themeName).toBe('compact');
  });

  it('should ignore invalid theme names', () => {
    let themeContext: any;
    
    const TestThemeConsumer: React.FC = () => {
      themeContext = useTheme();
      return <div>Test</div>;
    };

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    const originalTheme = themeContext.theme;
    themeContext.switchTheme('nonexistent');
    
    // Should remain unchanged
    expect(themeContext.theme).toBe(originalTheme);
    expect(themeContext.themeName).toBe('default');
  });

  it('should allow setting custom themes', () => {
    let themeContext: any;
    
    const TestThemeConsumer: React.FC = () => {
      themeContext = useTheme();
      return <div>Test</div>;
    };

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    );

    // Set custom theme
    themeContext.setTheme(compactTheme);
    expect(themeContext.theme).toBe(compactTheme);
    expect(themeContext.themeName).toBe('compact');
  });
});
