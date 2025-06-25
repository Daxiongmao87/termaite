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
