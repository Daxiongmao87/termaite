const fs = require('fs');
const path = require('path');
const os = require('os');

class AgentManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.agents = configManager.getAgents();
    this.rotationStrategy = configManager.getRotationStrategy();
    this.statePath = path.join(os.homedir(), '.termaite', 'state.json');
    this.currentAgentIndex = this.loadState();
    this.failedAgents = new Map(); // Map to track failed agents and their cooldown periods
  }
  
  /**
   * Load the current agent index from state file
   * @returns {number} The current agent index
   */
  loadState() {
    try {
      if (fs.existsSync(this.statePath)) {
        const state = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
        return state.currentAgentIndex || 0;
      }
    } catch (error) {
      // Ignore errors, return default
    }
    return 0;
  }
  
  /**
   * Save the current agent index to state file
   */
  saveState() {
    try {
      const state = {
        currentAgentIndex: this.currentAgentIndex
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
    if (['round-robin', 'exhaustion', 'random'].includes(strategy)) {
      this.rotationStrategy = strategy;
    }
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