#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const GradientChatUI = require('./components/GradientChatUI.cjs');
const ConfigManager = require('./managers/ConfigManager.cjs');
const HistoryManager = require('./managers/HistoryManager.cjs');
const AgentManager = require('./managers/AgentManager.cjs');
const AgentWrapper = require('./services/AgentWrapper.cjs');
const HistoryCompactor = require('./managers/HistoryCompactor.cjs');
const PipeAnimation = require('./components/PipeAnimation.cjs');
const { spawn } = require('child_process');
const os = require('os');

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
    // Execute the agent command
    AgentWrapper.executeAgentCommand(agent, argv.prompt, historyManager.readHistory())
      .then(result => {
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
        process.exit(1);
      });
  } else {
    console.error('No agents available');
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
const chatUI = new GradientChatUI();

// Create the pipe animation
const pipeAnimation = new PipeAnimation(chatUI);

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
      chatUI.addMessage('History cleared', 'system');
      break;
      
    case 'exit':
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
        chatUI.addMessage('No agents available for compaction', 'system');
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
        // Start the pipe animation
        pipeAnimation.start();
        
        try {
          const result = await AgentWrapper.executeAgentCommand(
            initAgent, 
            'Please investigate the current project and write comprehensive yet high-level details of the project and general guidelines in working in it.', 
            []
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
          // Stop the pipe animation
          pipeAnimation.stop();
        }
      } else {
        chatUI.addMessage('No agents available for initialization', 'system');
      }
      break;
      
    case 'config':
      const configPath = configManager.configPath;
      const editor = process.env.EDITOR || 'vi';
      
      chatUI.addMessage(`Opening config file: ${configPath}`, 'system');
      chatUI.getScreen().render();
      
      const editorProcess = spawn(editor, [configPath], {
        stdio: 'inherit',
        shell: true
      });
      
      editorProcess.on('close', (code) => {
        if (code === 0) {
          chatUI.addMessage('Config file closed', 'system');
          // Reload the config
          configManager.config = configManager.loadConfig();
          agentManager.agents = configManager.getAgents();
          agentManager.rotationStrategy = configManager.getRotationStrategy();
        } else {
          chatUI.addMessage(`Editor exited with code ${code}`, 'system');
        }
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
      // Start the pipe animation
      pipeAnimation.start();
      
      // Execute the agent command
      try {
        const history = historyManager.readHistory();
        const result = await AgentWrapper.executeAgentCommand(agent, text, history);
        chatUI.addMessage(result.stdout, 'agent');
        
        // Add agent response to history
        historyManager.writeHistory({
          sender: 'agent',
          text: result.stdout,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        chatUI.addMessage(`Error executing agent: ${error.message}`, 'system');
        agentManager.markAgentAsFailed(agent.name);
      } finally {
        // Stop the pipe animation
        pipeAnimation.stop();
        // Refocus after agent response
        chatUI.getInputBox().focus();
        chatUI.getScreen().render();
      }
    } else {
      chatUI.addMessage('No agents available', 'system');
      chatUI.getInputBox().focus();
      chatUI.getScreen().render();
    }
  }
});