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
