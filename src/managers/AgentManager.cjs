const fs = require('fs');
const path = require('path');
const os = require('os');

class AgentManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.agents = configManager.getEnabledAgents(); // Only load enabled agents
    this.rotationStrategy = configManager.getRotationStrategy();
    this.globalTimeoutBuffer = configManager.getTimeoutBuffer(); // Get global timeout buffer in milliseconds
    this.statePath = path.join(os.homedir(), '.termaite', 'state.json');
    const state = this.loadState();
    this.currentAgentIndex = state.currentAgentIndex;
    this.selectedAgent = state.selectedAgent; // For manual mode
    this.temporaryAgent = null; // For one-time selection overrides
    this.failedAgents = new Map(); // Map to track failed agents and their cooldown periods
    this.lastUsedAgents = new Map(); // Map to track when agents were last used (for timeout buffer)
  }
  
  /**
   * Load the state from state file
   * @returns {object} The state object
   */
  loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        const state = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
        return {
          currentAgentIndex: state.currentAgentIndex || 0,
          selectedAgent: state.selectedAgent || null,
          strategy: state.strategy || this.rotationStrategy
        };
      }
    } catch (error) {
      // Ignore errors, return default
    }
    return {
      currentAgentIndex: 0,
      selectedAgent: null,
      strategy: this.rotationStrategy
    };
  }
  
  /**
   * Save the state to state file
   */
  saveState() {
    try {
      const state = {
        currentAgentIndex: this.currentAgentIndex,
        selectedAgent: this.selectedAgent,
        strategy: this.rotationStrategy
      };
      fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Get the next agent based on the rotation strategy
   * @returns {object|null} The next agent or null if no agents are available
   */
  getNextAgent() {
    if (this.agents.length === 0) {
      return null;
    }

    // Check for temporary agent selection first (one-time override)
    if (this.temporaryAgent) {
      const tempAgent = this.agents.find(agent => agent.name === this.temporaryAgent);
      this.temporaryAgent = null; // Clear after use
      if (tempAgent && !this.isAgentInCooldown(tempAgent.name) && !this.isAgentInTimeoutBuffer(tempAgent.name)) {
        return tempAgent;
      }
      // If temporary agent is in cooldown or timeout buffer, fall through to normal logic
    }

    // Filter out agents that are currently in cooldown or timeout buffer
    const availableAgents = this.agents.filter(agent => 
      !this.isAgentInCooldown(agent.name) && !this.isAgentInTimeoutBuffer(agent.name)
    );
    
    if (availableAgents.length === 0) {
      // If all agents are in cooldown or timeout buffer, we need to honor the adaptive retry mechanism
      // by selecting the agent with the lowest failure count
      let lowestFailureCount = Infinity;
      let selectedAgent = this.agents[0]; // fallback to first agent
      
      for (const agent of this.agents) {
        const agentStatus = this.failedAgents.get(agent.name);
        const failureCount = agentStatus ? agentStatus.failureCount : 0;
        
        if (failureCount < lowestFailureCount) {
          lowestFailureCount = failureCount;
          selectedAgent = agent;
        }
      }
      
      return selectedAgent;
    }

    switch (this.rotationStrategy) {
      case 'round-robin':
        return this.getNextAgentRoundRobin(availableAgents);
      case 'exhaustion':
        return this.getNextAgentExhaustion(availableAgents);
      case 'random':
        return this.getNextAgentRandom(availableAgents);
      case 'manual':
        return this.getNextAgentManual(availableAgents);
      default:
        // Default to round-robin if an unknown strategy is specified
        return this.getNextAgentRoundRobin(availableAgents);
    }
  }

  /**
   * Get the next agent using the round-robin strategy
   * @param {array} availableAgents - The list of available agents
   * @returns {object} The next agent
   */
  getNextAgentRoundRobin(availableAgents) {
    // Round-robin: Rotate through all agents in order
    // Keep incrementing until we find an available agent
    // Note: This modifies this.currentAgentIndex which affects the starting point for next call
    for (let i = 0; i < this.agents.length; i++) {
      const index = (this.currentAgentIndex + i) % this.agents.length;
      const agent = this.agents[index];
      const availableAgent = availableAgents.find(a => a.name === agent.name);
      
      if (availableAgent) {
        // Move to next agent for next call
        this.currentAgentIndex = (index + 1) % this.agents.length;
        this.saveState(); // Save the updated index
        return availableAgent;
      }
    }
    
    // If no agents available, reset index and return first available
    this.currentAgentIndex = 0;
    this.saveState();
    return availableAgents[0];
  }

  /**
   * Get the next agent using the exhaustion strategy
   * @param {array} availableAgents - The list of available agents
   * @returns {object} The next agent
   */
  getNextAgentExhaustion(availableAgents) {
    // Exhaustion strategy: Always try agents in priority order (list order)
    // Try the first available agent in the original list order
    // Unlike round-robin, we always start from the beginning of the list
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const availableAgent = availableAgents.find(a => a.name === agent.name);
      
      if (availableAgent) {
        // Found the highest priority available agent
        return availableAgent;
      }
    }
    
    // No agents available (shouldn't happen as we check earlier)
    return availableAgents[0];
  }

  /**
   * Get the next agent using the random strategy
   * @param {array} availableAgents - The list of available agents
   * @returns {object} The next agent
   */
  getNextAgentRandom(availableAgents) {
    const randomIndex = Math.floor(Math.random() * availableAgents.length);
    return availableAgents[randomIndex];
  }

  /**
   * Get the next agent using the manual strategy
   * @param {array} availableAgents - The list of available agents
   * @returns {object} The next agent
   */
  getNextAgentManual(availableAgents) {
    // Manual strategy: Use the selected agent if available, otherwise first available
    if (this.selectedAgent) {
      const selectedAgent = availableAgents.find(agent => agent.name === this.selectedAgent);
      if (selectedAgent) {
        return selectedAgent;
      }
      // If selected agent is in cooldown, fall back to first available
    }
    
    // No selected agent or selected agent unavailable, use first available
    return availableAgents[0];
  }

  /**
   * Mark an agent as failed
   * @param {string} agentName - The name of the agent that failed
   * @param {number} consecutiveFailures - The number of consecutive failures
   */
  markAgentAsFailed(agentName, consecutiveFailures = null) {
    // If consecutiveFailures is not provided, calculate it based on previous failures
    if (consecutiveFailures === null) {
      const agentStatus = this.failedAgents.get(agentName);
      consecutiveFailures = agentStatus ? agentStatus.failureCount + 1 : 1;
    }
    
    // Calculate cooldown period based on consecutive failures
    // Start with 1 minute and double for each consecutive failure, up to 30 minutes
    const baseCooldown = 1 * 60 * 1000; // 1 minute
    const maxCooldown = 30 * 60 * 1000; // 30 minutes
    const cooldownPeriod = Math.min(baseCooldown * Math.pow(2, consecutiveFailures - 1), maxCooldown);
    
    // Set the cooldown
    setTimeout(() => {
      this.failedAgents.delete(agentName);
    }, cooldownPeriod);
    
    this.failedAgents.set(agentName, {
      failureCount: consecutiveFailures,
      cooldownUntil: Date.now() + cooldownPeriod
    });
  }

  /**
   * Check if an agent is currently in cooldown
   * @param {string} agentName - The name of the agent
   * @returns {boolean} True if the agent is in cooldown, false otherwise
   */
  isAgentInCooldown(agentName) {
    const agentStatus = this.failedAgents.get(agentName);
    if (!agentStatus) {
      return false;
    }
    
    // Check if cooldown period has expired
    if (Date.now() > agentStatus.cooldownUntil) {
      this.failedAgents.delete(agentName);
      return false;
    }
    
    return true;
  }

  /**
   * Get the timeout buffer for a specific agent (supports both global and per-agent timeout buffers)
   * @param {string} agentName - The name of the agent
   * @returns {number} Timeout buffer in milliseconds
   */
  getAgentTimeoutBuffer(agentName) {
    // First check if the agent has a specific timeout buffer
    const agent = this.agents.find(a => a.name === agentName);
    if (agent && agent.timeoutBuffer) {
      return this.configManager.parseTimeoutBuffer(agent.timeoutBuffer);
    }
    
    // Fall back to global timeout buffer
    return this.globalTimeoutBuffer;
  }

  /**
   * Mark an agent as used (for timeout buffer tracking)
   * @param {string} agentName - The name of the agent that was used
   */
  markAgentAsUsed(agentName) {
    const timeoutBuffer = this.getAgentTimeoutBuffer(agentName);
    if (timeoutBuffer > 0) {
      this.lastUsedAgents.set(agentName, Date.now());
    }
  }

  /**
   * Check if an agent is in timeout buffer (recently used)
   * @param {string} agentName - The name of the agent
   * @returns {boolean} True if the agent is in timeout buffer, false otherwise
   */
  isAgentInTimeoutBuffer(agentName) {
    const timeoutBuffer = this.getAgentTimeoutBuffer(agentName);
    if (timeoutBuffer <= 0) {
      return false; // No timeout buffer configured
    }

    const lastUsed = this.lastUsedAgents.get(agentName);
    if (!lastUsed) {
      return false; // Agent has never been used
    }

    const timeSinceLastUse = Date.now() - lastUsed;
    return timeSinceLastUse < timeoutBuffer;
  }

  /**
   * Get the remaining timeout buffer time for an agent
   * @param {string} agentName - The name of the agent
   * @returns {number} Remaining timeout buffer time in milliseconds, or 0 if not in timeout
   */
  getRemainingTimeoutBuffer(agentName) {
    const timeoutBuffer = this.getAgentTimeoutBuffer(agentName);
    if (timeoutBuffer <= 0) {
      return 0;
    }

    const lastUsed = this.lastUsedAgents.get(agentName);
    if (!lastUsed) {
      return 0;
    }

    const timeSinceLastUse = Date.now() - lastUsed;
    const remaining = timeoutBuffer - timeSinceLastUse;
    return Math.max(0, remaining);
  }

  /**
   * Update the rotation strategy
   * @param {string} strategy - The new rotation strategy
   */
  updateRotationStrategy(strategy) {
    // Handle backward compatibility for old "exhaust" value
    if (strategy === 'exhaust') {
      strategy = 'exhaustion';
    }
    
    if (['round-robin', 'exhaustion', 'random', 'manual'].includes(strategy)) {
      this.rotationStrategy = strategy;
      this.saveState();
    }
  }

  /**
   * Select an agent for manual mode or temporary override
   * @param {string} agentName - The name of the agent to select
   * @param {boolean} temporary - Whether this is a temporary selection (default: false)
   * @returns {boolean} True if agent was found and selected
   */
  selectAgent(agentName, temporary = false) {
    const agent = this.agents.find(a => a.name === agentName);
    if (!agent) {
      return false;
    }

    if (temporary) {
      this.temporaryAgent = agentName;
    } else {
      this.selectedAgent = agentName;
      this.saveState();
    }
    
    return true;
  }

  /**
   * Set the rotation strategy
   * @param {string} strategy - The new rotation strategy
   * @returns {boolean} True if strategy was valid and set
   */
  setStrategy(strategy) {
    // Handle backward compatibility for old "exhaust" value
    if (strategy === 'exhaust') {
      strategy = 'exhaustion';
    }
    
    if (['round-robin', 'exhaustion', 'random', 'manual'].includes(strategy)) {
      this.rotationStrategy = strategy;
      this.saveState();
      
      // Also update the config file
      this.configManager.config.rotationStrategy = strategy;
      this.configManager.saveConfig();
      
      return true;
    }
    return false;
  }

  /**
   * Get the current rotation strategy
   * @returns {string} The current rotation strategy
   */
  getStrategy() {
    return this.rotationStrategy;
  }

  /**
   * Get the currently selected agent (for manual mode)
   * @returns {string|null} The selected agent name or null
   */
  getSelectedAgent() {
    return this.selectedAgent;
  }

  /**
   * Get agent status information
   * @returns {object} Status information for all agents (including disabled ones)
   */
  getAgentStatus() {
    // Get all agents (enabled and disabled) for status display
    const allAgents = this.configManager.getAgents();
    
    return {
      strategy: this.rotationStrategy,
      selectedAgent: this.selectedAgent,
      temporaryAgent: this.temporaryAgent,
      globalTimeoutBuffer: this.globalTimeoutBuffer,
      agents: allAgents.map(agent => ({
        name: agent.name,
        enabled: agent.enabled !== false, // Default to true if not specified
        available: agent.enabled !== false && !this.isAgentInCooldown(agent.name) && !this.isAgentInTimeoutBuffer(agent.name),
        failureCount: this.failedAgents.get(agent.name)?.failureCount || 0,
        cooldownUntil: this.failedAgents.get(agent.name)?.cooldownUntil || null,
        inTimeoutBuffer: this.isAgentInTimeoutBuffer(agent.name),
        remainingTimeoutBuffer: this.getRemainingTimeoutBuffer(agent.name),
        timeoutBuffer: this.getAgentTimeoutBuffer(agent.name)
      }))
    };
  }

  /**
   * Refresh the agents list from configuration
   * This should be called when the configuration changes
   */
  refreshAgents() {
    this.agents = this.configManager.getEnabledAgents();
  }

  /**
   * Add a new agent
   * @param {object} agent - The agent to add
   */
  addAgent(agent) {
    this.agents.push(agent);
  }

  /**
   * Get all agents
   * @returns {array} The list of agents
   */
  getAgents() {
    return this.agents;
  }

  /**
   * Get all available agents (not in cooldown or timeout buffer)
   * @returns {array} The list of available agents
   */
  getAvailableAgents() {
    return this.agents.filter(agent => 
      !this.isAgentInCooldown(agent.name) && !this.isAgentInTimeoutBuffer(agent.name)
    );
  }
}

module.exports = AgentManager;