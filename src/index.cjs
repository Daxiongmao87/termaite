#!/usr/bin/env node

// Ensure proper UTF-8 encoding and Unicode support
process.env.LANG = process.env.LANG || 'en_US.UTF-8';
process.env.LC_ALL = process.env.LC_ALL || 'en_US.UTF-8';

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Pre-process --web argument to handle the optional value case
let webArg = false;
const processedArgs = [];
const rawArgs = process.argv.slice(2);

for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i] === '--web' || rawArgs[i] === '-w') {
    // Check if next argument exists and is not another flag
    if (rawArgs[i + 1] && !rawArgs[i + 1].startsWith('-')) {
      webArg = rawArgs[i + 1];
      i++; // Skip the next argument as it's the web value
    } else {
      webArg = true;
    }
  } else {
    processedArgs.push(rawArgs[i]);
  }
}
const GradientChatUI = require('./components/GradientChatUI.cjs');
const ConfigManager = require('./managers/ConfigManager.cjs');
const HistoryManager = require('./managers/HistoryManager.cjs');
const AgentManager = require('./managers/AgentManager.cjs');
const AgentWrapper = require('./services/AgentWrapper.cjs');
const HistoryCompactor = require('./managers/HistoryCompactor.cjs');
const { estimateTokenCount } = require('./utils/tokenEstimator.cjs');
const SpinnerAnimation = require('./components/SpinnerAnimation.cjs');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');

const argv = yargs(processedArgs)
  .version(pkg.version)
  .option('continue', {
    alias: 'c',
    type: 'boolean',
    description: 'Automatically loads the chat history from the most recently used project'
  })
  .option('agent', {
    alias: 'a',
    type: 'string',
    description: 'Overrides the default rotation for the first turn, starting with the specified agent name'
  })
  .option('rotation', {
    alias: 'r',
    type: 'string',
    description: 'Overrides the rotationStrategy from settings.json for the current session'
  })
  .option('prompt', {
    alias: 'p',
    type: 'string',
    description: 'Enables non-interactive mode. The application will execute a single prompt with the chosen agent, print the result to stdout, and then exit'
  })
  .option('web', {
    alias: 'w',
    type: 'string',
    description: 'Start web interface. Optional [host:]port format (default: 127.0.0.1:7378)'
  })
  .alias('version', 'V')
  .alias('help', 'h')
  .argv;

// If in web mode, start the web server
if (webArg) {
  const WebServer = require('./components/WebServer.cjs');
  const webServer = new WebServer();
  
  // Parse host and port from the web argument
  let host = '127.0.0.1';
  let port = 7378;
  
  // If web argument has a value, parse it
  if (webArg && webArg !== true && typeof webArg === 'string') {
    if (webArg.includes(':')) {
      [host, port] = webArg.split(':');
      port = parseInt(port, 10);
    } else {
      port = parseInt(webArg, 10);
    }
  }
  
  // Validate port
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error('Invalid port number. Please provide a valid port between 1 and 65535.');
    process.exit(1);
  }
  
  // Start the web server
  webServer.start(host, port);
  return;
}

// If in non-interactive mode, execute the prompt and exit
if (argv.prompt) {
  // Create the config manager
  const configManager = new ConfigManager();
  
  // Create the history manager
  const historyManager = new HistoryManager(process.cwd());
  
  // Handle --continue flag in non-interactive mode
  if (argv.continue) {
    const mostRecentHistoryPath = HistoryManager.getMostRecentProject();
    if (mostRecentHistoryPath) {
      const loadedHistory = HistoryManager.loadHistoryFromPath(mostRecentHistoryPath);
      if (loadedHistory.length > 0) {
        historyManager.replaceHistory(loadedHistory);
      }
    }
  }
  
  // Create the agent manager
  const agentManager = new AgentManager(configManager);
  
  // Get the agent (considering overrides from command line)
  let agent;
  if (argv.agent && argv.agent !== 'auto') {
    agent = configManager.getAgents().find(a => a.name === argv.agent);
  } else {
    agent = agentManager.getNextAgent();
  }
  
  if (agent) {
    // Show which agent is being used in stderr so it doesn't interfere with stdout
    console.error(`[Using agent: ${agent.name}]`);
    
    // Propagate instructions before executing agent command
    configManager.propagateInstructions();
    
    // Execute the agent command with global timeout
    const globalTimeout = configManager.getGlobalTimeout();
    AgentWrapper.executeAgentCommand(agent, argv.prompt, historyManager.readHistory(), globalTimeout)
      .then(result => {
        // Check if agent failed (non-zero exit code or empty output)
        const isOutputEmpty = !result.stdout || result.stdout.trim() === '';
        if (result.exitCode !== 0 || isOutputEmpty) {
          if (isOutputEmpty) {
            console.error(`Agent ${agent.name} failed: Empty response received`);
          } else {
            console.error(`Agent ${agent.name} failed with exit code ${result.exitCode}`);
            if (result.stderr) {
              console.error('Error output:', result.stderr);
            }
          }
          // Mark agent as failed
          agentManager.markAgentAsFailed(agent.name);
          
          // Try all available agents
          const availableAgents = agentManager.getAvailableAgents();
          const remainingAgents = availableAgents.filter(a => a.name !== agent.name);
          
          if (remainingAgents.length > 0) {
            console.error(`Retrying with ${remainingAgents.length} alternative agents...`);
            
            // Try each remaining agent until one succeeds
            let agentIndex = 0;
            const tryNextAgent = () => {
              if (agentIndex >= remainingAgents.length) {
                console.error('All alternative agents failed');
                process.exit(1);
                return;
              }
              
              const nextAgent = remainingAgents[agentIndex];
              agentIndex++;
              
              console.error(`Retrying with agent: ${nextAgent.name}`);
              // Propagate instructions before retry
              configManager.propagateInstructions();
              
              AgentWrapper.executeAgentCommand(nextAgent, argv.prompt, historyManager.readHistory(), globalTimeout)
                .then(retryResult => {
                  const isRetryOutputEmpty = !retryResult.stdout || retryResult.stdout.trim() === '';
                  if (retryResult.exitCode === 0 && !isRetryOutputEmpty) {
                    // Success
                    console.log(retryResult.stdout);
                    // Add to history
                    historyManager.writeHistory({
                      sender: 'user',
                      text: argv.prompt,
                      timestamp: new Date().toISOString()
                    });
                    historyManager.writeHistory({
                      sender: 'agent',
                      text: retryResult.stdout,
                      timestamp: new Date().toISOString()
                    });
                    process.exit(0);
                  } else {
                    // This agent also failed, try the next one
                    if (isRetryOutputEmpty) {
                      console.error(`Agent ${nextAgent.name} failed: Empty response received`);
                    } else {
                      console.error(`Agent ${nextAgent.name} failed with exit code ${retryResult.exitCode}`);
                      if (retryResult.stderr) {
                        console.error('Error output:', retryResult.stderr);
                      }
                    }
                    agentManager.markAgentAsFailed(nextAgent.name);
                    tryNextAgent(); // Try next agent
                  }
                })
                .catch(error => {
                  console.error(`Error with agent ${nextAgent.name}:`, error.message);
                  agentManager.markAgentAsFailed(nextAgent.name);
                  tryNextAgent(); // Try next agent
                });
            };
            
            tryNextAgent(); // Start trying remaining agents
          } else {
            console.error('No alternative agents available');
            process.exit(1);
          }
        }
        
        console.log(result.stdout);
        // Add to history
        historyManager.writeHistory({
          sender: 'user',
          text: argv.prompt,
          timestamp: new Date().toISOString()
        });
        historyManager.writeHistory({
          sender: 'agent',
          text: result.stdout,
          timestamp: new Date().toISOString()
        });
        process.exit(0);
      })
      .catch(error => {
        console.error('Error executing agent:', error.message);
        agentManager.markAgentAsFailed(agent.name);
        
        // Try all available agents
        const availableAgents = agentManager.getAvailableAgents();
        const remainingAgents = availableAgents.filter(a => a.name !== agent.name);
        
        if (remainingAgents.length > 0) {
          console.error(`Retrying with ${remainingAgents.length} alternative agents...`);
          
          // Try each remaining agent until one succeeds
          let agentIndex = 0;
          const tryNextAgent = () => {
            if (agentIndex >= remainingAgents.length) {
              console.error('All alternative agents failed');
              process.exit(1);
              return;
            }
            
            const nextAgent = remainingAgents[agentIndex];
            agentIndex++;
            
            console.error(`Retrying with agent: ${nextAgent.name}`);
            
            AgentWrapper.executeAgentCommand(nextAgent, argv.prompt, historyManager.readHistory(), globalTimeout)
              .then(retryResult => {
                const isRetryOutputEmpty = !retryResult.stdout || retryResult.stdout.trim() === '';
                if (retryResult.exitCode === 0 && !isRetryOutputEmpty) {
                  // Success
                  console.log(retryResult.stdout);
                  // Add to history
                  historyManager.writeHistory({
                    sender: 'user',
                    text: argv.prompt,
                    timestamp: new Date().toISOString()
                  });
                  historyManager.writeHistory({
                    sender: 'agent',
                    text: retryResult.stdout,
                    timestamp: new Date().toISOString()
                  });
                  process.exit(0);
                } else {
                  // This agent also failed, try the next one
                  if (isRetryOutputEmpty) {
                    console.error(`Agent ${nextAgent.name} failed: Empty response received`);
                  } else {
                    console.error(`Agent ${nextAgent.name} failed with exit code ${retryResult.exitCode}`);
                    if (retryResult.stderr) {
                      console.error('Error output:', retryResult.stderr);
                    }
                  }
                  agentManager.markAgentAsFailed(nextAgent.name);
                  tryNextAgent(); // Try next agent
                }
              })
              .catch(err => {
                console.error(`Error with agent ${nextAgent.name}:`, err.message);
                agentManager.markAgentAsFailed(nextAgent.name);
                tryNextAgent(); // Try next agent
              });
          };
          
          tryNextAgent(); // Start trying remaining agents
        } else {
          console.error('No alternative agents available');
          process.exit(1);
        }
      });
  } else {
    console.error('No agents configured in ~/.termaite/settings.json');
    console.error('\nPlease add at least one agent to your settings.json file.');
    console.error('Example agent configuration:\n');
    console.error(JSON.stringify({
      name: "claude",
      command: "claude --print --dangerously-skip-permissions",
      contextWindowTokens: 200000,
      timeoutSeconds: 120  // Optional: defaults to 300, use 0 for no timeout
    }, null, 2));
    console.error('\nCommon agent commands (non-interactive modes with permission bypass):');
    console.error('  claude --print --dangerously-skip-permissions');
    console.error('  gemini --prompt --yolo');
    console.error('  qwen --prompt --yolo');
    console.error('  cursor-agent --print --force');
    console.error('  llxprt --prompt --yolo');
    process.exit(1);
  }
  
  return;
}

// Create the config manager
const configManager = new ConfigManager();

// Handle --continue flag to load most recent project history
let projectPath = process.cwd();
let loadedHistory = [];

if (argv.continue) {
  const mostRecentHistoryPath = HistoryManager.getMostRecentProject();
  if (mostRecentHistoryPath) {
    loadedHistory = HistoryManager.loadHistoryFromPath(mostRecentHistoryPath);
    // Extract project path from history path if possible
    // For now, we'll just use the current directory but mark that history was loaded
    console.log(`Loaded history from most recent project (${loadedHistory.length} entries)`);
  }
}

// Create the history manager
const historyManager = new HistoryManager(projectPath);

// If we loaded history from --continue, replace current history with it
if (argv.continue && loadedHistory.length > 0) {
  historyManager.replaceHistory(loadedHistory);
} else if (!argv.continue) {
  // If not continuing, start with fresh history (clear any existing history)
  historyManager.clearHistory();
  historyManager.clearUserInputs();
}

// Create the agent manager with rotation strategy override if provided
const agentManager = new AgentManager(configManager);
if (argv.rotation) {
  agentManager.updateRotationStrategy(argv.rotation);
}

// Create the history compactor
const historyCompactor = new HistoryCompactor(configManager, historyManager);

// Create the chat UI
const chatUI = new GradientChatUI(historyManager);

// Create the spinner animation
const spinnerAnimation = new SpinnerAnimation(chatUI);

// Handle display based on whether we're continuing or starting fresh
if (argv.continue && loadedHistory.length > 0) {
  // Build the full history content first
  let historyContent = '';
  
  loadedHistory.forEach(entry => {
    if (entry.sender === 'user') {
      historyContent += `{bold}You:{/bold} ${entry.text}\n`;
    } else if (entry.sender === 'agent') {
      historyContent += `${entry.text}\n`;
    } else if (entry.sender === 'agent-announcement') {
      // Display agent announcements with color coding
      const agentMatch = entry.text.match(/Agent \(([^)]+)\):/);
      if (agentMatch) {
        const agentName = agentMatch[1];
        const color = getAgentColor(agentName);
        historyContent += `{bold}{${color}-fg}${entry.text}{/${color}-fg}{/bold}\n`;
      } else {
        historyContent += `{bold}${entry.text}{/bold}\n`;
      }
    } else if (entry.sender === 'system') {
      historyContent += `${entry.text}\n`;
    } else if (entry.sender === 'shell') {
      historyContent += `{green-fg}${entry.text}{/green-fg}\n`;
    }
  });
  
  // Set all content at once
  chatUI.chatBox.setContent(historyContent);
  chatUI.getScreen().render();
  
  // Also populate the message arrays for consistency
  loadedHistory.forEach(entry => {
    const formattedMessage = entry.sender === 'user' ? 
      `{bold}You:{/bold} ${entry.text}` : entry.text;
    chatUI.messagesBeforeSpinner.push(formattedMessage);
  });
} else {
  // Display welcome message for new sessions
  chatUI.displayWelcomeMessage();
}

// Function to handle slash commands
async function handleSlashCommand(text) {
  const command = text.substring(1).split(' ')[0];
  const args = text.substring(1).split(' ').slice(1);
  
  switch (command) {
    case 'clear':
      historyManager.clearHistory();
      historyManager.clearUserInputs();
      chatUI.clearChat();
      chatUI.addMessage('History cleared', 'system');
      break;
      
    case 'exit':
      chatUI.getScreen().leave();
      process.exit(0);
      break;
      
    case 'help':
      chatUI.addMessage('Available commands:', 'system');
      chatUI.addMessage('/clear - Clear the chat history', 'system');
      chatUI.addMessage('/exit - Exit the application', 'system');
      chatUI.addMessage('/help - Show this help message', 'system');
      chatUI.addMessage('/compact - Compact the chat history', 'system');
      chatUI.addMessage('/select <agent> - Select agent for next prompt (or permanently in manual mode)', 'system');
      chatUI.addMessage('/strategy [mode] - Show or set rotation strategy (round-robin, exhaustion, random, manual)', 'system');
      chatUI.addMessage('/agents - Show agent status and current configuration', 'system');
      chatUI.addMessage('/init - Initialize the project', 'system');
      chatUI.addMessage('/config - Open the configuration file', 'system');
      chatUI.addMessage('/instructions - Edit global agent instructions', 'system');
      chatUI.addMessage('/sh <command> - Execute shell command', 'system');
      break;
      
    case 'compact':
      chatUI.addMessage('Compacting history...', 'system');
      chatUI.getScreen().render();
      
      // Get the next agent for summarization
      const agent = agentManager.getNextAgent();
      if (agent) {
        try {
          const stats = await historyCompactor.manualCompactHistory(agent);
          chatUI.addMessage(`History compacted successfully: ${stats.entriesSummarized} entries → 1 summary (${stats.tokensSaved} tokens saved)`, 'system');
        } catch (error) {
          chatUI.addMessage(`Error compacting history: ${error.message}`, 'system');
        }
      } else {
        chatUI.addMessage('No agents configured. Please add agents to ~/.termaite/settings.json', 'system');
        chatUI.addMessage('Use /config to open the settings file', 'system');
      }
      break;
      
    case 'select':
      if (args.length > 0) {
        const agentName = args[0];
        const agent = configManager.getAgents().find(a => a.name === agentName);
        if (agent) {
          // Determine if this is temporary based on strategy
          const isTemporary = agentManager.getStrategy() !== 'manual';
          
          if (agentManager.selectAgent(agentName, isTemporary)) {
            if (isTemporary) {
              chatUI.addMessage(`Selected ${agentName} for next prompt only`, 'system');
            } else {
              chatUI.addMessage(`Selected ${agentName} (manual mode)`, 'system');
            }
          } else {
            chatUI.addMessage(`Agent not found: ${agentName}`, 'system');
          }
        } else {
          chatUI.addMessage(`Agent not found: ${agentName}`, 'system');
        }
      } else {
        // Fall through to agents case when no argument provided
        const status = agentManager.getAgentStatus();
        
        if (status.selectedAgent) {
          const selectedColor = getAgentColor(status.selectedAgent);
          chatUI.addMessage(`Selected agent: {bold}{${selectedColor}-fg}${status.selectedAgent}{/${selectedColor}-fg}{/bold}`, 'system');
        }
        
        if (status.temporaryAgent) {
          const tempColor = getAgentColor(status.temporaryAgent);
          chatUI.addMessage(`Next prompt will use: {bold}{${tempColor}-fg}${status.temporaryAgent}{/${tempColor}-fg}{/bold}`, 'system');
        }
        
        chatUI.addMessage('Agent status:', 'system');
        const agents = configManager.getAgents();
        status.agents.forEach(agentStatus => {
          const agent = agents.find(a => a.name === agentStatus.name);
          const color = getAgentColor(agentStatus.name);
          const statusText = agentStatus.available ? 'available' : 'cooldown';
          const contextWindow = agent ? agent.contextWindowTokens.toLocaleString() : 'unknown';
          chatUI.addMessage(`- {bold}{${color}-fg}${agentStatus.name}{/${color}-fg}{/bold}`, 'system');
          chatUI.addMessage(`    status:         ${statusText}`, 'system');
          chatUI.addMessage(`    context window: ${contextWindow}`, 'system');
        });
      }
      break;
      
    case 'strategy':
      if (args.length > 0) {
        const strategy = args[0];
        if (agentManager.setStrategy(strategy)) {
          chatUI.addMessage(`Rotation strategy set to: ${strategy}`, 'system');
        } else {
          chatUI.addMessage(`Invalid strategy: ${strategy}`, 'system');
          chatUI.addMessage('Available strategies: round-robin, exhaustion, random, manual', 'system');
        }
      } else {
        const currentStrategy = agentManager.getStrategy();
        chatUI.addMessage(`Current strategy: ${currentStrategy}`, 'system');
        chatUI.addMessage('Available strategies:', 'system');
        chatUI.addMessage('  round-robin - Rotate through agents in order', 'system');
        chatUI.addMessage('  exhaustion - Always try agents in priority order (list order)', 'system');
        chatUI.addMessage('  random - Pick agents randomly', 'system');
        chatUI.addMessage('  manual - Use selected agent only, no rotation', 'system');
      }
      break;
      
    case 'agents':
      const status = agentManager.getAgentStatus();
      
      if (status.selectedAgent) {
        const selectedColor = getAgentColor(status.selectedAgent);
        chatUI.addMessage(`Selected agent: {bold}{${selectedColor}-fg}${status.selectedAgent}{/${selectedColor}-fg}{/bold}`, 'system');
      }
      
      if (status.temporaryAgent) {
        const tempColor = getAgentColor(status.temporaryAgent);
        chatUI.addMessage(`Next prompt will use: {bold}{${tempColor}-fg}${status.temporaryAgent}{/${tempColor}-fg}{/bold}`, 'system');
      }
      
      chatUI.addMessage('Agent status:', 'system');
      const agents = configManager.getAgents();
      status.agents.forEach(agentStatus => {
        const agent = agents.find(a => a.name === agentStatus.name);
        const color = getAgentColor(agentStatus.name);
        const statusText = agentStatus.available ? 'available' : 'cooldown';
        const contextWindow = agent ? agent.contextWindowTokens.toLocaleString() : 'unknown';
        chatUI.addMessage(`- {bold}{${color}-fg}${agentStatus.name}{/${color}-fg}{/bold}`, 'system');
        chatUI.addMessage(`    status:         ${statusText}`, 'system');
        chatUI.addMessage(`    context window: ${contextWindow}`, 'system');
      });
      break;
      
    case 'init':
      const allAgents = configManager.getAgents();
      if (allAgents.length === 0) {
        chatUI.addMessage('No agents configured. Please add agents to ~/.termaite/settings.json', 'system');
        chatUI.addMessage('Use /config to open the settings file', 'system');
        break;
      }

      chatUI.addMessage('Initializing project...', 'system');
      chatUI.getScreen().render();
      
      // Start the spinner animation
      spinnerAnimation.start();
      
      try {
        const globalTimeout = configManager.getGlobalTimeout();
        configManager.propagateInstructions();
        
        // Send /init to all agents in parallel
        const initPromises = allAgents.map(async (agent) => {
          try {
            chatUI.addMessage(`Initializing ${agent.name}...`, 'system');
            chatUI.getScreen().render();
            const result = await AgentWrapper.executeAgentCommand(agent, '/init', [], globalTimeout);
            // Check if initialization failed due to empty response
            const isOutputEmpty = !result.stdout || result.stdout.trim() === '';
            if (result.exitCode !== 0 || isOutputEmpty) {
              if (isOutputEmpty) {
                chatUI.addMessage(`Warning: ${agent.name} initialization failed: Empty response received`, 'system');
              } else {
                chatUI.addMessage(`Warning: ${agent.name} initialization failed with exit code ${result.exitCode}`, 'system');
              }
            }
            // Discard the response - agents handle their own initialization
          } catch (error) {
            chatUI.addMessage(`Warning: ${agent.name} initialization failed: ${error.message}`, 'system');
          }
        });
        
        // Wait for all agents to complete
        await Promise.all(initPromises);
        chatUI.addMessage('Initialization complete', 'system');
        
      } catch (error) {
        chatUI.addMessage(`Error during initialization: ${error.message}`, 'system');
      } finally {
        // Stop the spinner animation
        spinnerAnimation.stop();
      }
      break;
      
    case 'instructions':
      const instructionsPath = path.join(os.homedir(), '.termaite', 'TERMAITE.md');
      const instructionsEditor = process.env.EDITOR || 'vi';
      
      chatUI.addMessage(`Opening instructions file: ${instructionsPath}`, 'system');
      chatUI.getScreen().render();
      
      // Use blessed's built-in exec method for proper terminal handling
      chatUI.getScreen().exec(instructionsEditor, [instructionsPath], {}, (err, success) => {
        if (!err) {
          chatUI.addMessage('Instructions file closed', 'system');
          // Propagate instructions to configured agents
          configManager.propagateInstructions();
        } else {
          chatUI.addMessage(`Editor error: ${err.message}`, 'system');
        }
        
        // Refocus the input box
        chatUI.getInputBox().focus();
        chatUI.getScreen().render();
      });
      break;
      
    case 'config':
      const configPath = configManager.configPath;
      const editor = process.env.EDITOR || 'vi';
      
      chatUI.addMessage(`Opening config file: ${configPath}`, 'system');
      chatUI.getScreen().render();
      
      // Use blessed's built-in exec method for proper terminal handling
      chatUI.getScreen().exec(editor, [configPath], {}, (err, success) => {
        if (!err) {
          chatUI.addMessage('Config file closed', 'system');
          // Reload the config
          configManager.config = configManager.loadConfig();
          agentManager.agents = configManager.getAgents();
          agentManager.rotationStrategy = configManager.getRotationStrategy();
        } else {
          chatUI.addMessage(`Editor error: ${err.message}`, 'system');
        }
        
        // Refocus the input box
        chatUI.getInputBox().focus();
        chatUI.getScreen().render();
      });
      break;
      
    case 'sh':
      if (args.length === 0) {
        chatUI.addMessage('Usage: /sh <command>', 'system');
        break;
      }
      
      const shellCommand = args.join(' ');
      chatUI.addMessage(`{gray-fg}$ ${shellCommand}{/gray-fg}`, 'system');
      chatUI.getScreen().render();
      
      // Execute shell command
      try {
        const { spawn } = require('child_process');
        const process = spawn(shellCommand, { shell: true, cwd: historyManager.projectPath });
        
        let stdout = '';
        let stderr = '';
        
        // Start spinner
        spinnerAnimation.start();
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (exitCode) => {
          spinnerAnimation.stop();
          
          // Display output
          if (stdout.trim()) {
            // Limit output size to prevent UI issues
            const maxOutputSize = 10000;
            const displayOutput = stdout.length > maxOutputSize 
              ? stdout.substring(0, maxOutputSize) + '\n... (output truncated)'
              : stdout.trim();
            chatUI.addMessage(displayOutput, 'system');
          }
          
          if (stderr.trim()) {
            const maxOutputSize = 10000;
            const displayError = stderr.length > maxOutputSize 
              ? stderr.substring(0, maxOutputSize) + '\n... (error output truncated)'
              : stderr.trim();
            chatUI.addMessage(`{red-fg}${displayError}{/red-fg}`, 'system');
          }
          
          // Show exit code if non-zero
          if (exitCode !== 0) {
            chatUI.addMessage(`{red-fg}(Exit code: ${exitCode}){/red-fg}`, 'system');
          }
          
          // Add to history
          const commandOutput = `$ ${shellCommand}\n${stdout}${stderr ? stderr : ''}${exitCode !== 0 ? `(Exit code: ${exitCode})` : ''}`;
          historyManager.writeHistory({
            sender: 'shell',
            text: commandOutput,
            timestamp: new Date().toISOString()
          });
          
          chatUI.getInputBox().focus();
          chatUI.getScreen().render();
        });
        
        process.on('error', (error) => {
          spinnerAnimation.stop();
          chatUI.addMessage(`{red-fg}Command error: ${error.message}{/red-fg}`, 'system');
          
          // Add error to history
          historyManager.writeHistory({
            sender: 'shell',
            text: `$ ${shellCommand}\nError: ${error.message}`,
            timestamp: new Date().toISOString()
          });
          
          chatUI.getInputBox().focus();
          chatUI.getScreen().render();
        });
        
        // Set timeout (30 seconds)
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGTERM');
            spinnerAnimation.stop();
            chatUI.addMessage(`{yellow-fg}Command timed out after 30 seconds{/yellow-fg}`, 'system');
            chatUI.getInputBox().focus();
            chatUI.getScreen().render();
          }
        }, 30000);
        
      } catch (error) {
        chatUI.addMessage(`{red-fg}Failed to execute command: ${error.message}{/red-fg}`, 'system');
      }
      break;
      
    default:
      chatUI.addMessage(`Unknown command: ${command}`, 'system');
      chatUI.addMessage('Available commands:', 'system');
      chatUI.addMessage('/clear - Clear the chat history', 'system');
      chatUI.addMessage('/exit - Exit the application', 'system');
      chatUI.addMessage('/help - Show this help message', 'system');
      chatUI.addMessage('/compact - Compact the chat history', 'system');
      chatUI.addMessage('/select <agent> - Select agent for next prompt (or permanently in manual mode)', 'system');
      chatUI.addMessage('/strategy [mode] - Show or set rotation strategy (round-robin, exhaustion, random, manual)', 'system');
      chatUI.addMessage('/agents - Show agent status and current configuration', 'system');
      chatUI.addMessage('/init - Initialize the project', 'system');
      chatUI.addMessage('/config - Open the configuration file', 'system');
      chatUI.addMessage('/instructions - Edit global agent instructions', 'system');
      chatUI.addMessage('/sh <command> - Execute shell command', 'system');
  }
}

// Helper function to get agent color with rich 256-color palette
function getAgentColor(agentName) {
  // Rich 256-color palette for agents with good contrast and distinctiveness
  const colors = [
    // Bright primary colors
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
    // Vibrant secondary colors  
    '#FF8A80', '#80CBC4', '#81C784', '#FFB74D', '#F06292', '#9575CD',
    '#4FC3F7', '#AED581', '#FFD54F', '#A1887F', '#90A4AE', '#EF5350',
    // Rich tertiary colors
    '#26A69A', '#AB47BC', '#5C6BC0', '#42A5F5', '#66BB6A', '#FFCA28',
    '#FF7043', '#8D6E63', '#78909C', '#EC407A', '#7E57C2', '#29B6F6',
    // Additional vibrant options
    '#FFAB91', '#C5E1A5', '#FFF176', '#BCAAA4', '#B0BEC5', '#FFCDD2',
    '#E1BEE7', '#C8E6C9', '#FFF9C4', '#D7CCC8', '#CFD8DC', '#FFCCBC'
  ];
  
  // Use a more sophisticated hash for better color distribution
  let hash = 0;
  for (let i = 0; i < agentName.length; i++) {
    const char = agentName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
}

// Track if we need to use a specific agent for the first interaction
let firstInteraction = true;
let overrideAgent = null;

// Track if an agent is currently running
let agentIsRunning = false;

if (argv.agent && argv.agent !== 'auto') {
  overrideAgent = configManager.getAgents().find(a => a.name === argv.agent);
  if (!overrideAgent) {
    chatUI.addMessage(`Warning: Agent '${argv.agent}' not found, using default rotation`, 'system');
  }
}

// Handle input
chatUI.getInputBox().on('submit', async (text) => {
  // Block submission if agent is running
  if (agentIsRunning) {
    // Don't clear the input, just ignore the submission
    return;
  }
  
  if (text) {
    // Handle slash commands
    if (text.startsWith('/')) {
      const command = text.substring(1).split(' ')[0];
      
      // Special handling for /exit - only log for arrow navigation, don't show in chat
      if (command === 'exit') {
        historyManager.appendToUserInputsFile(text); // For arrow navigation only
        await handleSlashCommand(text);
        return;
      }
      
      // For all other slash commands, add to both chat UI and history files
      chatUI.addMessage(text, 'user');
      historyManager.appendToUserInputsFile(text); // For arrow navigation
      historyManager.writeHistory({
        sender: 'user',
        text: text,
        timestamp: new Date().toISOString()
      });
      
      await handleSlashCommand(text);
      chatUI.getInputBox().clearValue();
      chatUI.getInputBox().focus();
      chatUI.getScreen().render();
      return;
    }
    
    chatUI.addMessage(text, 'user');
    chatUI.getInputBox().clearValue();
    chatUI.getInputBox().focus();
    chatUI.getScreen().render();
    
    // Simple input size handling like gemini-cli
    const inputTokens = estimateTokenCount(text);
    const agents = configManager.getAgents();
    if (agents.length > 0) {
      const smallestContext = Math.min(...agents.map(a => a.contextWindowTokens));
      const maxInputTokens = Math.floor(smallestContext * 0.5); // 50% of smallest context
      
      if (inputTokens > maxInputTokens) {
        // Auto-truncate like gemini-cli
        const targetChars = maxInputTokens * 4; // Rough estimate
        const truncatedText = text.substring(0, targetChars) + '... [TRUNCATED]';
        const newTokens = estimateTokenCount(truncatedText);
        
        chatUI.addMessage(`⚠️  Input truncated: ${inputTokens} → ${newTokens} tokens`, 'system');
        text = truncatedText;
        chatUI.getScreen().render();
      }
    }
    
    // Add to both user inputs (for arrow navigation) and chat history (for context)
    historyManager.writeUserInput(text);
    
    // Get the next agent (use override for first interaction if specified)
    let agent;
    if (firstInteraction && overrideAgent) {
      agent = overrideAgent;
      firstInteraction = false;
    } else {
      agent = agentManager.getNextAgent();
    }
    if (agent) {
      // Show which agent is being used with rich color coding
      const color = getAgentColor(agent.name);
      chatUI.addMessage(`{bold}{${color}-fg}Agent (${agent.name}):{/${color}-fg}{/bold}`, 'system');
      
      // Write agent announcement to history
      historyManager.writeHistory({
        sender: 'agent-announcement',
        text: `Agent (${agent.name}):`,
        timestamp: new Date().toISOString()
      });
      
      // Track that we added 2 messages (user + agent announcement) for cancellation
      const messagesToRevert = 2;
      
      // Mark agent as running
      agentIsRunning = true;
      
      // Start the spinner animation
      spinnerAnimation.start();
      
      // Propagate instructions before executing agent command
      configManager.propagateInstructions();
      
      // Track if we cancelled to skip finally cleanup
      let wasCancelled = false;
      
      // Add ESC key handler for cancellation
      const escHandler = (ch, key) => {
        if (key && key.name === 'escape') {
          // Cancel the current agent command
          if (AgentWrapper.cancelCurrentCommand()) {
            // Immediate visual reversion
            wasCancelled = true;
            spinnerAnimation.stop();
            chatUI.removeLastMessages(messagesToRevert);
            agentIsRunning = false;
            chatUI.getScreen().removeListener('keypress', escHandler);
            
            // Also remove from history
            historyManager.removeLastEntry();
          }
        }
      };
      chatUI.getScreen().on('keypress', escHandler);
      
      // Execute the agent command with global timeout
      try {
        const history = historyManager.readHistory();
        const globalTimeout = configManager.getGlobalTimeout();
        
        // Check if automatic compaction is needed before processing (including incoming text)
        if (historyCompactor.isCompactionNeeded(text)) {
          chatUI.addMessage('Auto-compacting history to maintain context window...', 'system');
          chatUI.getScreen().render();
          
          try {
            const stats = await historyCompactor.compactHistory(agent);
            chatUI.addMessage(`History auto-compacted: ${stats.entriesSummarized} entries (${stats.tokensSaved} tokens saved)`, 'system');
          } catch (error) {
            chatUI.addMessage(`Warning: Auto-compaction failed: ${error.message}`, 'system');
            // Continue with message processing even if compaction fails
          }
          chatUI.getScreen().render();
        }
        
        const result = await AgentWrapper.executeAgentCommand(agent, text, history, globalTimeout);
        
        // Check if agent failed (non-zero exit code or empty output)
        const isOutputEmpty = !result.stdout || result.stdout.trim() === '';
        if (result.exitCode !== 0 || isOutputEmpty) {
          // Exit code 137 means SIGKILL (128 + 9)
          // Don't show anything for cancellation - already handled by ESC handler
          if (result.exitCode === 137 || result.exitCode === null) {
            // Cancelled - do nothing, ESC handler already cleaned up
          } else {
            if (isOutputEmpty) {
              chatUI.addMessage(`Agent ${agent.name} failed: Empty response received`, 'system');
            } else {
              chatUI.addMessage(`Agent ${agent.name} failed with exit code ${result.exitCode}`, 'system');
              if (result.stderr) {
                chatUI.addMessage(`Error: ${result.stderr}`, 'system');
              }
            }
            agentManager.markAgentAsFailed(agent.name);
          
            // Try all available agents
            const availableAgents = agentManager.getAvailableAgents();
            const remainingAgents = availableAgents.filter(a => a.name !== agent.name);
            
            if (remainingAgents.length > 0) {
              // Try each remaining agent until one succeeds
              let agentIndex = 0;
              const tryNextAgent = async () => {
                if (agentIndex >= remainingAgents.length) {
                  chatUI.addMessage('All alternative agents failed', 'system');
                  return false;
                }
                
                const nextAgent = remainingAgents[agentIndex];
                agentIndex++;
                
                const color = getAgentColor(nextAgent.name);
                chatUI.addMessage(`{bold}{${color}-fg}Agent (${nextAgent.name}):{/${color}-fg}{/bold}`, 'system');
                
                // Write agent announcement to history
                historyManager.writeHistory({
                  sender: 'agent-announcement',
                  text: `Agent (${nextAgent.name}):`,
                  timestamp: new Date().toISOString()
                });
                
                configManager.propagateInstructions();
                
                try {
                  const retryResult = await AgentWrapper.executeAgentCommand(nextAgent, text, history, globalTimeout);
                  const isRetryOutputEmpty = !retryResult.stdout || retryResult.stdout.trim() === '';
                  
                  if (retryResult.exitCode === 0 && !isRetryOutputEmpty) {
                    // Success
                    chatUI.addMessage(retryResult.stdout, 'agent');
                    // Add agent response to history
                    historyManager.writeHistory({
                      sender: 'agent',
                      text: retryResult.stdout,
                      timestamp: new Date().toISOString()
                    });
                    return true;
                  } else {
                    // This agent also failed, try the next one
                    if (isRetryOutputEmpty) {
                      chatUI.addMessage(`Agent ${nextAgent.name} failed: Empty response received`, 'system');
                    } else {
                      chatUI.addMessage(`Agent ${nextAgent.name} failed with exit code ${retryResult.exitCode}`, 'system');
                      if (retryResult.stderr) {
                        chatUI.addMessage(`Error: ${retryResult.stderr}`, 'system');
                      }
                    }
                    agentManager.markAgentAsFailed(nextAgent.name);
                    return await tryNextAgent(); // Try next agent
                  }
                } catch (retryError) {
                  chatUI.addMessage(`Error with agent ${nextAgent.name}: ${retryError.message}`, 'system');
                  agentManager.markAgentAsFailed(nextAgent.name);
                  return await tryNextAgent(); // Try next agent
                }
              };
              
              await tryNextAgent(); // Start trying remaining agents
            } else {
              chatUI.addMessage('No alternative agents available', 'system');
            }
          }
        } else {
          chatUI.addMessage(result.stdout, 'agent');
          
          // Add agent response to history
          historyManager.writeHistory({
            sender: 'agent',
            text: result.stdout,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Check if this was a cancellation (SIGKILL signal or killed message)
        if (error.message && (error.message.includes('SIGKILL') || error.message.includes('killed'))) {
          // Cancelled - do nothing, ESC handler already cleaned up
        } else {
          chatUI.addMessage(`Error executing agent: ${error.message}`, 'system');
          agentManager.markAgentAsFailed(agent.name);
        
          // Try all available agents
          const availableAgents = agentManager.getAvailableAgents();
          const remainingAgents = availableAgents.filter(a => a.name !== agent.name);
          
          if (remainingAgents.length > 0) {
            // Try each remaining agent until one succeeds
            let agentIndex = 0;
            const tryNextAgent = async () => {
              if (agentIndex >= remainingAgents.length) {
                chatUI.addMessage('All alternative agents failed', 'system');
                return false;
              }
              
              const nextAgent = remainingAgents[agentIndex];
              agentIndex++;
              
              const color = getAgentColor(nextAgent.name);
              chatUI.addMessage(`{bold}{${color}-fg}Agent (${nextAgent.name}):{/${color}-fg}{/bold}`, 'system');
              
              // Write agent announcement to history
              historyManager.writeHistory({
                sender: 'agent-announcement',
                text: `Agent (${nextAgent.name}):`,
                timestamp: new Date().toISOString()
              });
              
              try {
                const history = historyManager.readHistory();
                configManager.propagateInstructions();
                const retryResult = await AgentWrapper.executeAgentCommand(nextAgent, text, history, globalTimeout);
                const isRetryOutputEmpty = !retryResult.stdout || retryResult.stdout.trim() === '';
                
                if (retryResult.exitCode === 0 && !isRetryOutputEmpty) {
                  // Success
                  chatUI.addMessage(retryResult.stdout, 'agent');
                  // Add agent response to history
                  historyManager.writeHistory({
                    sender: 'agent',
                    text: retryResult.stdout,
                    timestamp: new Date().toISOString()
                  });
                  return true;
                } else {
                  // This agent also failed, try the next one
                  if (isRetryOutputEmpty) {
                    chatUI.addMessage(`Agent ${nextAgent.name} failed: Empty response received`, 'system');
                  } else {
                    chatUI.addMessage(`Agent ${nextAgent.name} failed with exit code ${retryResult.exitCode}`, 'system');
                    if (retryResult.stderr) {
                      chatUI.addMessage(`Error: ${retryResult.stderr}`, 'system');
                    }
                  }
                  agentManager.markAgentAsFailed(nextAgent.name);
                  return await tryNextAgent(); // Try next agent
                }
              } catch (retryError) {
                chatUI.addMessage(`Error with agent ${nextAgent.name}: ${retryError.message}`, 'system');
                agentManager.markAgentAsFailed(nextAgent.name);
                return await tryNextAgent(); // Try next agent
              }
            };
            
            await tryNextAgent(); // Start trying remaining agents
          } else {
            chatUI.addMessage('No alternative agents available', 'system');
          }
        }
      } finally {
        // Only do cleanup if we didn't already cancel
        if (!wasCancelled) {
          // Mark agent as no longer running
          agentIsRunning = false;
          // Remove the ESC key handler
          chatUI.getScreen().removeListener('keypress', escHandler);
          // Stop the spinner animation
          spinnerAnimation.stop();
          // Refocus after agent response
          chatUI.getInputBox().focus();
          chatUI.getScreen().render();
        }
      }
    } else {
      chatUI.addMessage('No agents configured in ~/.termaite/settings.json', 'system');
      chatUI.addMessage('', 'system');
      chatUI.addMessage('Please add at least one agent to your settings.json file.', 'system');
      chatUI.addMessage('Use /config to open the settings file, then add an agent like:', 'system');
      chatUI.addMessage('', 'system');
      chatUI.addMessage(JSON.stringify({
        name: "claude",
        command: "claude --print --dangerously-skip-permissions",
        contextWindowTokens: 200000,
        timeoutSeconds: 120  // Optional: defaults to 300, use 0 for no timeout
      }, null, 2), 'system');
      chatUI.addMessage('', 'system');
      chatUI.addMessage('Common agent commands (non-interactive modes with permission bypass):', 'system');
      chatUI.addMessage('  claude --print --dangerously-skip-permissions', 'system');
      chatUI.addMessage('  gemini --prompt --yolo', 'system');
      chatUI.addMessage('  qwen --prompt --yolo', 'system');
      chatUI.addMessage('  cursor-agent --print --force', 'system');
      chatUI.addMessage('  llxprt --prompt --yolo', 'system');
      chatUI.getInputBox().focus();
      chatUI.getScreen().render();
    }
  }
});