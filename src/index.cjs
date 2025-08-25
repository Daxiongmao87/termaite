#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const GradientChatUI = require('./components/GradientChatUI.cjs');
const ConfigManager = require('./managers/ConfigManager.cjs');
const HistoryManager = require('./managers/HistoryManager.cjs');
const AgentManager = require('./managers/AgentManager.cjs');
const AgentWrapper = require('./services/AgentWrapper.cjs');
const HistoryCompactor = require('./managers/HistoryCompactor.cjs');
const SpinnerAnimation = require('./components/SpinnerAnimation.cjs');
const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const argv = yargs(hideBin(process.argv))
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
  .argv;

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
        // Check if agent failed (non-zero exit code)
        if (result.exitCode !== 0) {
          console.error(`Agent ${agent.name} failed with exit code ${result.exitCode}`);
          if (result.stderr) {
            console.error('Error output:', result.stderr);
          }
          // Mark agent as failed and try next one
          agentManager.markAgentAsFailed(agent.name);
          
          // Try to get another agent
          const nextAgent = agentManager.getNextAgent();
          if (nextAgent && nextAgent.name !== agent.name) {
            console.error(`Retrying with agent: ${nextAgent.name}`);
            // Propagate instructions before retry
            configManager.propagateInstructions();
            // Recursively try with next agent
            return AgentWrapper.executeAgentCommand(nextAgent, argv.prompt, historyManager.readHistory(), globalTimeout);
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
        
        // Try to get another agent
        const nextAgent = agentManager.getNextAgent();
        if (nextAgent && nextAgent.name !== agent.name) {
          console.error(`Retrying with agent: ${nextAgent.name}`);
          // Try with next agent
          AgentWrapper.executeAgentCommand(nextAgent, argv.prompt, historyManager.readHistory(), globalTimeout)
            .then(result => {
              if (result.exitCode === 0) {
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
              } else {
                console.error(`Agent ${nextAgent.name} also failed with exit code ${result.exitCode}`);
                process.exit(1);
              }
            })
            .catch(err => {
              console.error('Error executing fallback agent:', err.message);
              process.exit(1);
            });
        } else {
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
}

// Create the agent manager with rotation strategy override if provided
const agentManager = new AgentManager(configManager);
if (argv.rotation) {
  agentManager.updateRotationStrategy(argv.rotation);
}

// Create the history compactor
const historyCompactor = new HistoryCompactor(configManager, historyManager);

// Check if compaction is needed
if (historyCompactor.isCompactionNeeded()) {
  // Get the next agent for summarization
  const agent = agentManager.getNextAgent();
  if (agent) {
    historyCompactor.compactHistory(agent)
      .then(() => {
        // Log success
      })
      .catch((error) => {
        console.error('Error compacting history:', error);
      });
  }
}

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
    } else if (entry.sender === 'system') {
      historyContent += `${entry.text}\n`;
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
      break;
      
    case 'compact':
      chatUI.addMessage('Compacting history...', 'system');
      chatUI.getScreen().render();
      
      // Get the next agent for summarization
      const agent = agentManager.getNextAgent();
      if (agent) {
        try {
          await historyCompactor.manualCompactHistory(agent);
          chatUI.addMessage('History compacted successfully', 'system');
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
      chatUI.addMessage('Initializing project...', 'system');
      chatUI.getScreen().render();
      
      // Get the next agent for initialization
      const initAgent = agentManager.getNextAgent();
      if (initAgent) {
        // Start the spinner animation
        spinnerAnimation.start();
        
        try {
          const globalTimeout = configManager.getGlobalTimeout();
          configManager.propagateInstructions();
          const result = await AgentWrapper.executeAgentCommand(
            initAgent, 
            'Please investigate the current project and write comprehensive yet high-level details of the project and general guidelines in working in it.', 
            [],
            globalTimeout
          );
          chatUI.addMessage(result.stdout, 'agent');
          
          // Add agent response to history
          historyManager.writeHistory({
            sender: 'agent',
            text: result.stdout,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          chatUI.addMessage(`Error initializing project: ${error.message}`, 'system');
        } finally {
          // Stop the spinner animation
          spinnerAnimation.stop();
        }
      } else {
        chatUI.addMessage('No agents configured. Please add agents to ~/.termaite/settings.json', 'system');
        chatUI.addMessage('Use /config to open the settings file', 'system');
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
  }
}

// Helper function to get agent color
function getAgentColor(agentName) {
  const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
  const colorIndex = agentName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
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
      // Add command to chat UI and history
      chatUI.addMessage(text, 'user');
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
    
    // Add to history
    historyManager.writeHistory({
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    });
    
    // Get the next agent (use override for first interaction if specified)
    let agent;
    if (firstInteraction && overrideAgent) {
      agent = overrideAgent;
      firstInteraction = false;
    } else {
      agent = agentManager.getNextAgent();
    }
    if (agent) {
      // Show which agent is being used with color coding
      const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
      const colorIndex = agent.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
      const color = colors[colorIndex];
      chatUI.addMessage(`{bold}{${color}-fg}Agent (${agent.name}):{/${color}-fg}{/bold}`, 'system');
      
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
        const result = await AgentWrapper.executeAgentCommand(agent, text, history, globalTimeout);
        
        // Check if agent failed (non-zero exit code)
        if (result.exitCode !== 0) {
          // Exit code 137 means SIGKILL (128 + 9)
          // Don't show anything for cancellation - already handled by ESC handler
          if (result.exitCode === 137 || result.exitCode === null) {
            // Cancelled - do nothing, ESC handler already cleaned up
          } else {
            chatUI.addMessage(`Agent ${agent.name} failed with exit code ${result.exitCode}`, 'system');
            if (result.stderr) {
              chatUI.addMessage(`Error: ${result.stderr}`, 'system');
            }
            agentManager.markAgentAsFailed(agent.name);
          
            // Try next agent
            const nextAgent = agentManager.getNextAgent();
            if (nextAgent && nextAgent.name !== agent.name) {
              const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
              const colorIndex = nextAgent.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
              const color = colors[colorIndex];
              chatUI.addMessage(`{bold}{${color}-fg}Agent (${nextAgent.name}):{/${color}-fg}{/bold}`, 'system');
              configManager.propagateInstructions();
              const retryResult = await AgentWrapper.executeAgentCommand(nextAgent, text, history, globalTimeout);
              if (retryResult.exitCode === 0) {
                chatUI.addMessage(retryResult.stdout, 'agent');
                // Add agent response to history
                historyManager.writeHistory({
                  sender: 'agent',
                  text: retryResult.stdout,
                  timestamp: new Date().toISOString()
                });
              } else {
                chatUI.addMessage(`Agent ${nextAgent.name} also failed`, 'system');
              }
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
        
          // Try next agent
          const nextAgent = agentManager.getNextAgent();
          if (nextAgent && nextAgent.name !== agent.name) {
            const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
            const colorIndex = nextAgent.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
            const color = colors[colorIndex];
            chatUI.addMessage(`{bold}{${color}-fg}Agent (${nextAgent.name}):{/${color}-fg}{/bold}`, 'system');
            try {
              const history = historyManager.readHistory();
              configManager.propagateInstructions();
              const retryResult = await AgentWrapper.executeAgentCommand(nextAgent, text, history, globalTimeout);
              if (retryResult.exitCode === 0) {
                chatUI.addMessage(retryResult.stdout, 'agent');
                // Add agent response to history
                historyManager.writeHistory({
                  sender: 'agent',
                  text: retryResult.stdout,
                  timestamp: new Date().toISOString()
                });
              } else {
                chatUI.addMessage(`Agent ${nextAgent.name} also failed`, 'system');
              }
            } catch (retryError) {
              chatUI.addMessage(`Fallback agent error: ${retryError.message}`, 'system');
            }
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