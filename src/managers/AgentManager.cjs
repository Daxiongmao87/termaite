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
   * Peek at the next agent without actually selecting it (for testing)
   * @returns {object|null} The next agent or null if no agents are available
   */
  peekNextAgent() {
    if (this.agents.length === 0) {
      return null;
    }

    // Handle temporary agent if present and available
    if (this.temporaryAgent) {
      const tempAgent = this.agents.find(agent => agent.name === this.temporaryAgent);
      if (tempAgent && !this.isAgentUnavailable(tempAgent.name)) {
        return tempAgent;
      }
      // If temp unavailable, fall through to normal logic
    }

    const availableAgents = this.agents.filter(agent =>
      !this.isAgentUnavailable(agent.name)
    );
    if (availableAgents.length === 0) {
      return null;
    }

    switch (this.rotationStrategy) {
      case 'round-robin': {
        // Compute next without mutating currentAgentIndex
        for (let i = 0; i < this.agents.length; i++) {
          const index = (this.currentAgentIndex + i) % this.agents.length;
          const agent = this.agents[index];
          const availableAgent = availableAgents.find(a => a.name === agent.name);
          if (availableAgent) {
            return availableAgent;
          }
        }
        return availableAgents[0];
      }
      case 'exhaustion':
        return availableAgents.find(a => true) || null;
      case 'random': {
        const randomIndex = Math.floor(Math.random() * availableAgents.length);
        return availableAgents[randomIndex];
      }
      case 'manual': {
        if (this.selectedAgent) {
          const selectedAgent = availableAgents.find(a => a.name === this.selectedAgent);
          if (selectedAgent) return selectedAgent;
        }
        return availableAgents[0];
      }
      default:
        return availableAgents[0];
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
      if (tempAgent && !this.isAgentUnavailable(tempAgent.name)) {
        return tempAgent;
      }
      // If temporary agent is unavailable, fall through to normal logic
    }

    // Filter out agents that are currently unavailable due to any timeout mechanism
    const availableAgents = this.agents.filter(agent => 
      !this.isAgentUnavailable(agent.name)
    );
    
    if (availableAgents.length === 0) {
      // If all agents are in cooldown or timeout buffer, return null
      // The calling code should handle this by showing "no agents available at this time"
      return null;
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
   * @param {number} consecutiveFailures - The number of consecutive failures (optional, will be calculated if not provided)
   */
  markAgentAsFailed(agentName, consecutiveFailures = null) {
    const now = Date.now();
    const agentStatus = this.failedAgents.get(agentName);
    
    // If consecutiveFailures is not provided, calculate it based on previous failures
    if (consecutiveFailures === null) {
      if (agentStatus) {
        // Check if this is a consecutive failure (within the retry timer) or a new failure
        if (now < agentStatus.cooldownUntil) {
          // Agent is still in cooldown, this is a consecutive failure
          consecutiveFailures = agentStatus.failureCount + 1;
        } else {
          // Agent was out of cooldown, this is a new failure sequence
          consecutiveFailures = 1;
        }
      } else {
        // First failure for this agent
        consecutiveFailures = 1;
      }
    }
    
    // Calculate cooldown period based on the adaptive retry mechanism:
    // - First failure: 1 minute retry timer
    // - If fails again within timer: 2 minutes
    // - If fails again within timer: 4 minutes
    // - Continue doubling until 30 minutes cap
    const baseCooldown = 1 * 60 * 1000; // 1 minute
    const maxCooldown = 30 * 60 * 1000; // 30 minutes
    const cooldownPeriod = Math.min(baseCooldown * Math.pow(2, consecutiveFailures - 1), maxCooldown);
    
    // Clear any existing timeout for this agent
    if (agentStatus && agentStatus.timeoutId) {
      clearTimeout(agentStatus.timeoutId);
    }
    
    // Set the cooldown with timeout cleanup
    const timeoutId = setTimeout(() => {
      this.failedAgents.delete(agentName);
    }, cooldownPeriod);
    
    this.failedAgents.set(agentName, {
      failureCount: consecutiveFailures,
      cooldownUntil: now + cooldownPeriod,
      timeoutId: timeoutId
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
      // Clear the timeout and remove from failed agents
      if (agentStatus.timeoutId) {
        clearTimeout(agentStatus.timeoutId);
      }
      this.failedAgents.delete(agentName);
      return false;
    }
    
    return true;
  }

  /**
   * Get the remaining cooldown time for an agent
   * @param {string} agentName - The name of the agent
   * @returns {number} Remaining cooldown time in milliseconds, or 0 if not in cooldown
   */
  getRemainingCooldown(agentName) {
    const agentStatus = this.failedAgents.get(agentName);
    if (!agentStatus) {
      return 0;
    }
    
    const remaining = agentStatus.cooldownUntil - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Get the effective timeout for an agent (maximum of cooldown and timeout buffer)
   * @param {string} agentName - The name of the agent
   * @returns {number} Remaining effective timeout in milliseconds, or 0 if agent is available
   */
  getEffectiveTimeout(agentName) {
    const cooldownRemaining = this.getRemainingCooldown(agentName);
    const timeoutBufferRemaining = this.getRemainingTimeoutBuffer(agentName);
    
    // Return the longer of the two timeouts
    return Math.max(cooldownRemaining, timeoutBufferRemaining);
  }

  /**
   * Check if an agent is effectively unavailable due to any timeout mechanism
   * @param {string} agentName - The name of the agent
   * @returns {boolean} True if the agent is unavailable due to any timeout
   */
  isAgentUnavailable(agentName) {
    return this.getEffectiveTimeout(agentName) > 0;
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
   * Mark an agent as successful (resets failure count)
   * @param {string} agentName - The name of the agent that succeeded
   */
  markAgentAsSuccessful(agentName) {
    // Clear any existing failure status and timeout
    const agentStatus = this.failedAgents.get(agentName);
    if (agentStatus && agentStatus.timeoutId) {
      clearTimeout(agentStatus.timeoutId);
    }
    this.failedAgents.delete(agentName);
  }

  /**
   * Mark an agent as used (for timeout buffer tracking)
   * @param {string} agentName - The name of the agent that was used
   * @param {boolean} successful - Whether the agent execution was successful (default: true)
   */
  markAgentAsUsed(agentName, successful = true) {
    const timeoutBuffer = this.getAgentTimeoutBuffer(agentName);
    if (timeoutBuffer > 0) {
      this.lastUsedAgents.set(agentName, Date.now());
    }
    
    // If the agent was successful, reset its failure count
    if (successful) {
      this.markAgentAsSuccessful(agentName);
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
        available: agent.enabled !== false && !this.isAgentUnavailable(agent.name),
        failureCount: this.failedAgents.get(agent.name)?.failureCount || 0,
        cooldownUntil: this.failedAgents.get(agent.name)?.cooldownUntil || null,
        remainingCooldown: this.getRemainingCooldown(agent.name),
        inTimeoutBuffer: this.isAgentInTimeoutBuffer(agent.name),
        remainingTimeoutBuffer: this.getRemainingTimeoutBuffer(agent.name),
        effectiveTimeout: this.getEffectiveTimeout(agent.name),
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
   * Get all available agents (not in any timeout)
   * @returns {array} The list of available agents
   */
  getAvailableAgents() {
    return this.agents.filter(agent => 
      !this.isAgentUnavailable(agent.name)
    );
  }

  /**
   * Get alternative agents to try after a failure. Now respects both timeout mechanisms.
   * @param {string} excludeAgentName - The agent name to exclude from alternatives
   * @returns {array} Alternative agents that are available (not in any timeout)
   */
  getAlternativeAgents(excludeAgentName) {
    return this.agents.filter(agent =>
      agent.name !== excludeAgentName && !this.isAgentUnavailable(agent.name)
    );
  }
}

module.exports = AgentManager;