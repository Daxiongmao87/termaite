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
        
        // Create a default config file
        const defaultConfig = {
          rotationStrategy: 'round-robin',
          agents: []
        };
        fs.writeFileSync(this.configPath, JSON.stringify(defaultConfig, null, 2));
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
    return this.config.rotationStrategy || 'round-robin';
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
}

module.exports = ConfigManager;