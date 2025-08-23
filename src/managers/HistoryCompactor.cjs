const { estimateTokenCount } = require('../utils/tokenEstimator.cjs');
const AgentWrapper = require('../services/AgentWrapper.cjs');
const fs = require('fs');

class HistoryCompactor {
  constructor(configManager, historyManager) {
    this.configManager = configManager;
    this.historyManager = historyManager;
    this.globalTimeout = configManager.getGlobalTimeout();
  }

  /**
   * Get the smallest context window among all agents
   * @returns {number} The smallest context window
   */
  getSmallestContextWindow() {
    const agents = this.configManager.getAgents();
    if (agents.length === 0) {
      return 0;
    }
    return Math.min(...agents.map(agent => agent.contextWindowTokens));
  }

  /**
   * Check if automatic compaction is needed
   * @returns {boolean} True if compaction is needed, false otherwise
   */
  isCompactionNeeded() {
    const history = this.historyManager.readHistory();
    if (history.length === 0) {
      return false;
    }
    
    const totalTokenCount = history.reduce((total, entry) => {
      return total + estimateTokenCount(entry.text);
    }, 0);
    
    const smallestContextWindow = this.getSmallestContextWindow();
    const threshold = smallestContextWindow * 0.75; // 75% of the smallest context window
    
    return totalTokenCount > threshold;
  }

  /**
   * Compact the chat history by summarizing the oldest 50%
   * @param {object} agent - The agent to use for summarization
   * @returns {Promise<void>}
   */
  async compactHistory(agent) {
    const history = this.historyManager.readHistory();
    if (history.length === 0) {
      return;
    }
    
    // Calculate the midpoint
    const midpoint = Math.floor(history.length / 2);
    
    // Get the oldest 50% of the history
    const historyToSummarize = history.slice(0, midpoint);
    const historyToKeep = history.slice(midpoint);
    
    // Convert history to summarize into a string
    const historyString = historyToSummarize.map(entry => `${entry.sender}: ${entry.text}`).join('\n');
    
    // Request a summary from the agent
    try {
      const result = await AgentWrapper.executeAgentCommand(agent, `Please summarize the following chat history:\n\n${historyString}`, [], this.globalTimeout);
      
      // Create a new entry for the summary
      const summaryEntry = {
        sender: 'system',
        text: `Summary of previous conversation:\n${result.stdout}`,
        timestamp: new Date().toISOString()
      };
      
      // Write the new history
      // Clear the existing history file
      this.historyManager.clearHistory();
      
      // Write the summary entry and the remaining history
      this.historyManager.writeHistory(summaryEntry);
      historyToKeep.forEach(entry => this.historyManager.writeHistory(entry));
    } catch (error) {
      console.error('Error summarizing history:', error);
      throw error;
    }
  }
  
  /**
   * Manually compact the chat history by summarizing the oldest 50%
   * @param {object} agent - The agent to use for summarization
   * @returns {Promise<void>}
   */
  async manualCompactHistory(agent) {
    // This is essentially the same as compactHistory, but we might want to add specific logic for manual compaction
    return this.compactHistory(agent);
  }
}

module.exports = HistoryCompactor;