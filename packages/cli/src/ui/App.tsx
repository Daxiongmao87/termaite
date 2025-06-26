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
