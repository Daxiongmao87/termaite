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
