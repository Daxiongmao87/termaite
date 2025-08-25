const fs = require('fs');
const path = require('path');
const os = require('os');

class AgentManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.agents = configManager.getAgents();
    this.rotationStrategy = configManager.getRotationStrategy();
    this.statePath = path.join(os.homedir(), '.termaite', 'state.json');
    const state = this.loadState();
    this.currentAgentIndex = state.currentAgentIndex;
    this.selectedAgent = state.selectedAgent; // For manual mode
    this.temporaryAgent = null; // For one-time selection overrides
    this.failedAgents = new Map(); // Map to track failed agents and their cooldown periods
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
      if (tempAgent && !this.isAgentInCooldown(tempAgent.name)) {
        return tempAgent;
      }
      // If temporary agent is in cooldown, fall through to normal logic
    }

    // Filter out agents that are currently in cooldown
    const availableAgents = this.agents.filter(agent => !this.isAgentInCooldown(agent.name));
    
    if (availableAgents.length === 0) {
      // If all agents are in cooldown, we'll use the first one
      // In a more advanced implementation, we might want to wait or handle this differently
      return this.agents[0];
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
  markAgentAsFailed(agentName, consecutiveFailures = 1) {
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
   * Update the rotation strategy
   * @param {string} strategy - The new rotation strategy
   */
  updateRotationStrategy(strategy) {
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
    if (['round-robin', 'exhaustion', 'random', 'manual'].includes(strategy)) {
      this.rotationStrategy = strategy;
      this.saveState();
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
   * @returns {object} Status information for all agents
   */
  getAgentStatus() {
    return {
      strategy: this.rotationStrategy,
      selectedAgent: this.selectedAgent,
      temporaryAgent: this.temporaryAgent,
      agents: this.agents.map(agent => ({
        name: agent.name,
        available: !this.isAgentInCooldown(agent.name),
        cooldownUntil: this.failedAgents.get(agent.name)?.cooldownUntil || null
      }))
    };
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
}

module.exports = AgentManager;