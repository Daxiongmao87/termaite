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

// Display welcome message with ASCII art
chatUI.displayWelcomeMessage();

// If we loaded history with --continue, display it in the chat UI
if (argv.continue && loadedHistory.length > 0) {
  chatUI.addMessage('--- Previous conversation loaded ---', 'system');
  loadedHistory.forEach(entry => {
    if (entry.sender === 'user') {
      chatUI.addMessage(entry.text, 'user');
    } else if (entry.sender === 'agent') {
      chatUI.addMessage(entry.text, 'agent');
    } else if (entry.sender === 'system') {
      chatUI.addMessage(entry.text, 'system');
    }
  });
  chatUI.addMessage('--- Continue your conversation ---', 'system');
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
      chatUI.addMessage('/switch <agent> - Switch to a specific agent', 'system');
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
      
    case 'switch':
      if (args.length > 0) {
        const agentName = args[0];
        const agent = configManager.getAgents().find(a => a.name === agentName);
        if (agent) {
          // For now, we'll just display a message that the switch is requested
          // In a more advanced implementation, we might want to store this preference
          chatUI.addMessage(`Switch requested to agent: ${agentName}`, 'system');
        } else {
          chatUI.addMessage(`Agent not found: ${agentName}`, 'system');
        }
      } else {
        chatUI.addMessage('Usage: /switch <agent_name>', 'system');
      }
      break;
      
    case 'init':
      chatUI.addMessage('Initializing project...', 'system');
      chatUI.getScreen().render();
      
      // Get the next agent for initialization
      const initAgent = agentManager.getNextAgent();
      if (initAgent) {
        // Start the binary animation with init prompt
        binaryAnimation.start('Initializing project analysis');
        
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
          // Stop the binary animation
          binaryAnimation.stop();
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
  }
}

// Track if we need to use a specific agent for the first interaction
let firstInteraction = true;
let overrideAgent = null;

if (argv.agent && argv.agent !== 'auto') {
  overrideAgent = configManager.getAgents().find(a => a.name === argv.agent);
  if (!overrideAgent) {
    chatUI.addMessage(`Warning: Agent '${argv.agent}' not found, using default rotation`, 'system');
  }
}

// Handle input
chatUI.getInputBox().on('submit', async (text) => {
  if (text) {
    // Handle slash commands
    if (text.startsWith('/')) {
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
      // Show which agent is being used
      chatUI.addMessage(`Agent (${agent.name}):`, 'system');
      
      // Start the spinner animation
      spinnerAnimation.start();
      
      // Propagate instructions before executing agent command
      configManager.propagateInstructions();
      
      // Execute the agent command with global timeout
      try {
        const history = historyManager.readHistory();
        const globalTimeout = configManager.getGlobalTimeout();
        const result = await AgentWrapper.executeAgentCommand(agent, text, history, globalTimeout);
        
        // Check if agent failed (non-zero exit code)
        if (result.exitCode !== 0) {
          chatUI.addMessage(`Agent ${agent.name} failed with exit code ${result.exitCode}`, 'system');
          if (result.stderr) {
            chatUI.addMessage(`Error: ${result.stderr}`, 'system');
          }
          agentManager.markAgentAsFailed(agent.name);
          
          // Try next agent
          const nextAgent = agentManager.getNextAgent();
          if (nextAgent && nextAgent.name !== agent.name) {
            chatUI.addMessage(`Agent (${nextAgent.name}):`, 'system');
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
        chatUI.addMessage(`Error executing agent: ${error.message}`, 'system');
        agentManager.markAgentAsFailed(agent.name);
        
        // Try next agent
        const nextAgent = agentManager.getNextAgent();
        if (nextAgent && nextAgent.name !== agent.name) {
          chatUI.addMessage(`Agent (${nextAgent.name}):`, 'system');
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
      } finally {
        // Stop the spinner animation
        spinnerAnimation.stop();
        // Refocus after agent response
        chatUI.getInputBox().focus();
        chatUI.getScreen().render();
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