import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';
import { AppProps } from '../types.js';

export const App: React.FC<AppProps> = ({ 
  task,
  options,
  onExit 
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Initialize core connection
    setIsInitialized(true);
  }, []);

  // Handle Ctrl+C for cleanup
  useEffect(() => {
    const handleExit = () => {
      onExit();
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    return () => {
      process.off('SIGINT', handleExit);
      process.off('SIGTERM', handleExit);
    };
  }, [onExit]);

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
          term.ai.te v2.0 - AI Terminal Automation
        </Text>
        {options.debug && <Text color={theme.colors.warning}> [DEBUG MODE]</Text>}
      </Box>
      
      <Box flexGrow={1} padding={1} flexDirection="column">
        <Text color={theme.colors.info}>Mode: {options.mode}</Text>
        {task && (
          <Box marginTop={1}>
            <Text color={theme.colors.success}>Task: {task}</Text>
          </Box>
        )}
        {options.verbose && (
          <Box marginTop={1}>
            <Text color={theme.colors.dim}>Verbose logging enabled</Text>
          </Box>
        )}
        {options.config && (
          <Box marginTop={1}>
            <Text color={theme.colors.dim}>Config: {options.config}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={theme.colors.dim}>
            Ready for development. Press Ctrl+C to exit.
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
