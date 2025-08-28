const fs = require('fs');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configPath = path.join(os.homedir(), '.termaite', 'settings.json');
    this.config = this.loadConfig();
    this.onConfigReload = null; // Callback for when config is reloaded

    // Watch for changes to the config file
    fs.watch(this.configPath, (eventType, filename) => {
      if (eventType === 'change') {
        console.log(`Config file ${filename} changed. Reloading...`);
        this.reloadConfig();
      }
    });
  }

  /**
   * Generate an ID from an agent name
   * @param {string} name - The agent name
   * @returns {string} The generated ID (lowercase with dashes)
   */
  generateAgentId(name) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Parse a timeout buffer string into milliseconds
   * @param {string} timeoutBuffer - Timeout buffer string (e.g., "30s", "5m", "1h", "2d")
   * @returns {number} Timeout buffer in milliseconds
   */
  parseTimeoutBuffer(timeoutBuffer) {
    if (!timeoutBuffer || timeoutBuffer === "0") {
      return 0;
    }

    const match = timeoutBuffer.match(/^(\d+)([smhd])$/);
    if (!match) {
      console.warn(`Invalid timeout buffer format: ${timeoutBuffer}. Expected format: number + unit (s, m, h, d)`);
      return 0;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      's': 1000,        // seconds to milliseconds
      'm': 60 * 1000,   // minutes to milliseconds
      'h': 60 * 60 * 1000, // hours to milliseconds
      'd': 24 * 60 * 60 * 1000 // days to milliseconds
    };

    return value * multipliers[unit];
  }

  /**
   * Ensure all agents have IDs generated from their names
   */
  ensureAgentIds() {
    if (this.config.agents) {
      let needsUpdate = false;
      this.config.agents.forEach(agent => {
        if (!agent.id) {
          agent.id = this.generateAgentId(agent.name);
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        this.saveConfig();
      }
    }
  }

  /**
   * Load the configuration from the settings file
   * @returns {object} The configuration object
   */
  loadConfig() {
    // Ensure the config directory exists before attempting to read/write
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // If the config file doesn't exist, create it with defaults
    if (!fs.existsSync(this.configPath)) {
      return this.createDefaultConfig();
    }

    // Read and parse the config file
    const configData = fs.readFileSync(this.configPath, 'utf8');
    const config = JSON.parse(configData);

    // Ensure all agents have IDs
    if (config.agents) {
      let needsUpdate = false;
      config.agents.forEach(agent => {
        if (!agent.id) {
          agent.id = this.generateAgentId(agent.name);
          needsUpdate = true;
        }
      });
      if (needsUpdate) {
        // Save the updated config with IDs if any were generated
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      }
    }
    
    return config;
  }

  /**
   * Creates and saves a default configuration file.
   * @returns {object} The default configuration object.
   */
  createDefaultConfig() {
    const defaultConfig = {
      rotationStrategy: 'exhaustion',
      globalTimeoutSeconds: null,
      timeoutBuffer: '5m',
      agents: [
        {
          id: "claude",
          name: "claude",
          command: "claude --print --dangerously-skip-permissions",
          contextWindowTokens: 200000,
          timeoutSeconds: 300,
          enabled: true,
          instructionsFilepath: path.join(os.homedir(), '.claude', 'CLAUDE.md')
        },
        {
          id: "gemini-flash",
          name: "Gemini Flash",
          command: "gemini --prompt --yolo",
          contextWindowTokens: 1000000,
          timeoutSeconds: 300,
          enabled: true
        },
        {
          id: "qwen",
          name: "qwen",
          command: "qwen --prompt --yolo",
          contextWindowTokens: 128000,
          timeoutSeconds: 300,
          enabled: true
        },
        {
          id: "cursor",
          name: "cursor",
          command: "cursor-agent --print --force --output-format text",
          contextWindowTokens: 200000,
          timeoutSeconds: 300,
          enabled: true
        }
      ]
    };
    
    // Write the file without comments (JSON doesn't support comments)
    fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
    
    // Also create a template file with comments for reference
    const templatePath = path.join(path.dirname(this.configPath), 'settings.template.jsonc');
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
  
  // Timeout buffer (optional)
  // Prevents agents from being used again until this time has passed
  // Format: number + unit (s=seconds, m=minutes, h=hours, d=days)
  // Examples: "30s", "5m", "1h", "2d", "5m" (default buffer)
  "timeoutBuffer": "5m",
  
  // Agent configurations
  // Each agent needs: name, command, contextWindowTokens
  // Optional: timeoutSeconds (defaults to 300), enabled (defaults to true), instructionsFilepath (path to propagate instructions)
  // Agent names can contain spaces - IDs are auto-generated (lowercase with dashes)
  "agents": [
    {
      "id": "claude",
      "name": "claude",
      "command": "claude --print --dangerously-skip-permissions",
      "contextWindowTokens": 200000,
      "timeoutSeconds": 300,  // Optional: defaults to 300, use 0 for no timeout
      "enabled": true,  // Optional: defaults to true, set to false to disable agent
      "instructionsFilepath": "\${path.join(os.homedir(), '.claude', 'CLAUDE.md')}"  // Optional: path to propagate instructions from TERMAITE.md
    },
    {
      "id": "gemini-flash",
      "name": "Gemini Flash",
      "command": "gemini --prompt --yolo",
      "contextWindowTokens": 1000000,
      "timeoutSeconds": 300,
      "enabled": true
    },
    {
      "id": "qwen",
      "name": "qwen",
      "command": "qwen --prompt --yolo",
      "contextWindowTokens": 128000,
      "timeoutSeconds": 300,
      "enabled": true
    },
    {
      "id": "cursor",
      "name": "cursor",
      "command": "cursor-agent --print --force --output-format text",
      "contextWindowTokens": 200000,
      "timeoutSeconds": 300,
      "enabled": true
    }
    // Add more agents as needed
    // For local models, you may need to include full command with model parameters
    // Example for llxprt with local model:
    // {
    //   "name": "llxprt",
    //   "command": "llxprt --baseurl \\\\\\"http://localhost:11434/v1/\\\\\\" -m \\\\\\"model-name\\\\\\" --yolo --prompt",
    //   "contextWindowTokens": 20000,
    //   "timeoutSeconds": 300
    // }
  ]
}`;
    fs.writeFileSync(templatePath, configWithComments);
    
    console.log(`Created default settings at ${this.configPath}`);
    console.log(`Template with comments saved at ${templatePath}`);
    
    return defaultConfig;
  }

  /**
   * Reloads the configuration from the settings file.
   */
  reloadConfig() {
    try {
      this.config = this.loadConfig();
      console.log('Configuration reloaded.');
      // Emit an event or call a callback to notify other managers
      if (this.onConfigReload) {
        this.onConfigReload();
      }
    } catch (error) {
      console.error('Error reloading config:', error);
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
   * Get the timeout buffer configuration
   * @returns {number} The timeout buffer in milliseconds
   */
  getTimeoutBuffer() {
    const timeoutBuffer = this.config.timeoutBuffer || "0";
    return this.parseTimeoutBuffer(timeoutBuffer);
  }

  /**
   * Get the list of agents
   * @returns {array} The list of agents
   */
  getAgents() {
    return this.config.agents || [];
  }

  /**
   * Get the list of enabled agents only
   * @returns {array} The list of enabled agents
   */
  getEnabledAgents() {
    const agents = this.config.agents || [];
    return agents.filter(agent => agent.enabled !== false); // Default to true if not specified
  }

  /**
   * Find an agent by name or ID
   * @param {string} identifier - The agent name or ID
   * @returns {object|null} The agent object or null if not found
   */
  findAgent(identifier) {
    const agents = this.config.agents || [];
    return agents.find(agent => 
      agent.name === identifier || 
      agent.id === identifier ||
      agent.id === this.generateAgentId(identifier)
    );
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