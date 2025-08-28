const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.termaite', 'settings.json');
    this.config = this.loadConfig();
  }

  /**
   * Load the configuration from the settings file
   * @returns {object} The configuration object
   */
  loadConfig() {
    try {
      // Check if the config file exists
      if (!fs.existsSync(this.configPath)) {
        // Create the config directory if it doesn't exist
        const configDir = path.dirname(this.configPath);
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        
        // Create a comprehensive default config file with examples
        const defaultConfig = {
          rotationStrategy: 'exhaustion',
          globalTimeoutSeconds: null,  // Optional: override all agent timeouts
          agents: [
            {
              name: "claude",
              command: "claude --print --dangerously-skip-permissions",
              contextWindowTokens: 200000,
              timeoutSeconds: 300,  // Optional: defaults to 300, use 0 for no timeout
              instructionsFilepath: path.join(os.homedir(), '.claude', 'CLAUDE.md')  // Optional: path to propagate instructions
            },
            {
              name: "gemini",
              command: "gemini --prompt --yolo",
              contextWindowTokens: 1000000,
              timeoutSeconds: 300
            },
            {
              name: "qwen",
              command: "qwen --prompt --yolo",
              contextWindowTokens: 128000,
              timeoutSeconds: 300
            },
            {
              name: "cursor",
              command: "cursor-agent --print --force --output-format text",
              contextWindowTokens: 200000,
              timeoutSeconds: 300
            }
          ]
        };
        
        // Add helpful comments as a separate file
        const configWithComments = `{
  // Rotation strategies: 'exhaustion' (default), 'round-robin', or 'random'
  // - exhaustion: Always try agents in order, only moving to next on failure
  // - round-robin: Rotate through agents for each request
  // - random: Randomly select an agent for each request
  "rotationStrategy": "exhaustion",
  
  // Global timeout override (optional)
  // If set, overrides all individual agent timeouts
  // Use null to disable global override, 0 for no timeout
  "globalTimeoutSeconds": null,
  
  // Agent configurations
  // Each agent needs: name, command, contextWindowTokens
  // Optional: timeoutSeconds (defaults to 300), instructionsFilepath (path to propagate instructions)
  "agents": [
    {
      "name": "claude",
      "command": "claude --print --dangerously-skip-permissions",
      "contextWindowTokens": 200000,
      "timeoutSeconds": 300,  // Optional: defaults to 300, use 0 for no timeout
      "instructionsFilepath": "/home/user/.claude/CLAUDE.md"  // Optional: path to propagate instructions from TERMAITE.md
    },
    {
      "name": "gemini",
      "command": "gemini --prompt --yolo",
      "contextWindowTokens": 1000000,
      "timeoutSeconds": 300
    },
    {
      "name": "qwen",
      "command": "qwen --prompt --yolo",
      "contextWindowTokens": 128000,
      "timeoutSeconds": 300
    },
    {
      "name": "cursor",
      "command": "cursor-agent --print --force --output-format text",
      "contextWindowTokens": 200000,
      "timeoutSeconds": 300
    }
    // Add more agents as needed
    // For local models, you may need to include full command with model parameters
    // Example for llxprt with local model:
    // {
    //   "name": "llxprt",
    //   "command": "llxprt --baseurl \\"http://localhost:11434/v1/\\" -m \\"model-name\\" --yolo --prompt",
    //   "contextWindowTokens": 20000,
    //   "timeoutSeconds": 300
    // }
  ]
}`;
        
        // Write the file without comments (JSON doesn't support comments)
        fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
        
        // Also create a template file with comments for reference
        const templatePath = path.join(path.dirname(this.configPath), 'settings.template.jsonc');
        fs.writeFileSync(templatePath, configWithComments);
        
        console.log(`Created default settings at ${this.configPath}`);
        console.log(`Template with comments saved at ${templatePath}`);
        
        return defaultConfig;
      }
      
      // Read and parse the config file
      const configData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Error loading config:', error);
      return {
        rotationStrategy: 'round-robin',
        agents: []
      };
    }
  }

  /**
   * Get the configuration
   * @returns {object} The configuration object
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get the rotation strategy
   * @returns {string} The rotation strategy
   */
  getRotationStrategy() {
    const strategy = this.config.rotationStrategy || 'round-robin';
    
    // Handle backward compatibility for old "exhaust" value
    if (strategy === 'exhaust') {
      // Update the config file to use the correct value
      this.config.rotationStrategy = 'exhaustion';
      this.saveConfig();
      return 'exhaustion';
    }
    
    return strategy;
  }

  /**
   * Get the global timeout override
   * @returns {number|null} The global timeout in seconds, or null if not set
   */
  getGlobalTimeout() {
    return this.config.globalTimeoutSeconds !== undefined ? this.config.globalTimeoutSeconds : null;
  }

  /**
   * Get the list of agents
   * @returns {array} The list of agents
   */
  getAgents() {
    return this.config.agents || [];
  }

  /**
   * Add a new agent to the configuration
   * @param {object} agent - The agent to add
   */
  addAgent(agent) {
    this.config.agents.push(agent);
    this.saveConfig();
  }

  /**
   * Save the configuration to the settings file
   */
  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  /**
   * Propagate instructions from TERMAITE.md to configured agent instruction files
   */
  propagateInstructions() {
    const termaiteInstructionsPath = path.join(os.homedir(), '.termaite', 'TERMAITE.md');
    
    // Check if TERMAITE.md exists
    if (!fs.existsSync(termaiteInstructionsPath)) {
      return; // No instructions to propagate
    }
    
    // Read the TERMAITE.md content
    const instructions = fs.readFileSync(termaiteInstructionsPath, 'utf8');
    
    // Propagate to each agent that has an instructionsFilepath configured
    const agents = this.getAgents();
    agents.forEach(agent => {
      if (agent.instructionsFilepath) {
        try {
          // Ensure the directory exists
          const dir = path.dirname(agent.instructionsFilepath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write the instructions to the agent's filepath
          fs.writeFileSync(agent.instructionsFilepath, instructions, 'utf8');
        } catch (error) {
          console.error(`Failed to propagate instructions to ${agent.name}: ${error.message}`);
        }
      }
    });
  }
}

module.exports = ConfigManager;