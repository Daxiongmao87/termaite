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
