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
   * @param {string} [incomingText] - Optional text that will be added to history (for safety buffer)
   * @returns {boolean} True if compaction is needed, false otherwise
   */
  isCompactionNeeded(incomingText = '') {
    const history = this.historyManager.readHistory();
    if (history.length === 0) {
      return false;
    }
    
    const totalTokenCount = history.reduce((total, entry) => {
      return total + estimateTokenCount(entry.text);
    }, 0);
    
    // Add incoming text tokens as safety buffer if provided
    const incomingTokens = incomingText ? estimateTokenCount(incomingText) : 0;
    const totalWithIncoming = totalTokenCount + incomingTokens;
    
    const smallestContextWindow = this.getSmallestContextWindow();
    const threshold = smallestContextWindow * 0.75; // 75% of the smallest context window
    
    return totalWithIncoming > threshold;
  }

  /**
   * Compact the chat history by summarizing the oldest 50% by token count
   * @param {object} agent - The agent to use for summarization
   * @returns {Promise<void>}
   */
  async compactHistory(agent) {
    const history = this.historyManager.readHistory();
    if (history.length === 0) {
      return;
    }
    
    // Calculate total token count
    const totalTokens = history.reduce((total, entry) => {
      return total + estimateTokenCount(entry.text);
    }, 0);
    
    // Find split point where we have approximately 50% of tokens
    const targetTokens = Math.floor(totalTokens / 2);
    let cumulativeTokens = 0;
    let splitIndex = 0;
    
    for (let i = 0; i < history.length; i++) {
      cumulativeTokens += estimateTokenCount(history[i].text);
      if (cumulativeTokens >= targetTokens) {
        splitIndex = i + 1; // Include this entry in the summary
        break;
      }
    }
    
    // Ensure we always keep at least 1 entry and summarize at least 1 entry
    splitIndex = Math.max(1, Math.min(splitIndex, history.length - 1));
    
    // Get the oldest entries by token count (approximately 50%)
    const historyToSummarize = history.slice(0, splitIndex);
    const historyToKeep = history.slice(splitIndex);
    
    // Convert history to summarize into a string
    const historyString = historyToSummarize.map(entry => `${entry.sender}: ${entry.text}`).join('\n');
    
    // Calculate token counts for user feedback
    const tokensToSummarize = historyToSummarize.reduce((total, entry) => total + estimateTokenCount(entry.text), 0);
    const tokensToKeep = historyToKeep.reduce((total, entry) => total + estimateTokenCount(entry.text), 0);
    
    // Request a summary from the agent
    try {
      const result = await AgentWrapper.executeAgentCommand(agent, `Please summarize the following chat history as a concise bullet-point list of critical details:\n\n${historyString}`, [], this.globalTimeout);
      
      // Create a new entry for the summary
      const summaryTokens = estimateTokenCount(result.stdout);
      const summaryEntry = {
        sender: 'system',
        text: `Summary of previous conversation (${historyToSummarize.length} entries, ~${tokensToSummarize} tokens → ~${summaryTokens} tokens):\n${result.stdout}`,
        timestamp: new Date().toISOString()
      };
      
      // Write the new history
      // Clear the existing history file
      this.historyManager.clearHistory();
      
      // Write the summary entry and the remaining history
      this.historyManager.writeHistory(summaryEntry);
      historyToKeep.forEach(entry => this.historyManager.writeHistory(entry));
      
      // Return compaction stats for user feedback
      return {
        entriesSummarized: historyToSummarize.length,
        entriesKept: historyToKeep.length,
        tokensBeforeCompaction: totalTokens,
        tokensAfterCompaction: summaryTokens + tokensToKeep,
        tokensSaved: tokensToSummarize - summaryTokens
      };
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