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
   * @returns {Promise<object>} Compaction statistics
   */
  async compactHistory(agent) {
    // Validate agent parameter
    if (!agent) {
      throw new Error('Agent is required for history compaction');
    }
    
    if (!agent.command) {
      throw new Error('Agent command is required for history compaction');
    }

    const history = this.historyManager.readHistory();
    if (history.length === 0) {
      return {
        entriesSummarized: 0,
        entriesKept: 0,
        tokensBeforeCompaction: 0,
        tokensAfterCompaction: 0,
        tokensSaved: 0
      };
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
    
    // Request a summary from the agent with enhanced error handling
    try {
      const result = await AgentWrapper.executeAgentCommand(agent, `Please summarize the following chat history as a concise bullet-point list of critical details:\n\n${historyString}`, [], this.globalTimeout);
      
      // Validate the AI response
      if (!result.stdout || result.stdout.trim() === '') {
        throw new Error(`AI agent returned empty response for summarization (exit code: ${result.exitCode})`);
      }
      
      if (result.exitCode !== 0) {
        throw new Error(`AI agent failed with exit code ${result.exitCode}: ${result.stderr || 'No error details available'}`);
      }
      
      // Create a new entry for the summary
      const summaryTokens = estimateTokenCount(result.stdout);
      const summaryEntry = {
        sender: 'system',
        text: `Summary of previous conversation (${historyToSummarize.length} entries, ~${tokensToSummarize} tokens → ~${summaryTokens} tokens):\n${result.stdout}`,
        timestamp: new Date().toISOString()
      };
      
      // Write the new history with error handling
      try {
        // Clear the existing history file
        this.historyManager.clearHistory();
        
        // Write the summary entry and the remaining history
        this.historyManager.writeHistory(summaryEntry);
        historyToKeep.forEach(entry => this.historyManager.writeHistory(entry));
      } catch (fileError) {
        throw new Error(`Failed to write compacted history to file: ${fileError.message}`);
      }
      
      // Return compaction stats for user feedback
      return {
        entriesSummarized: historyToSummarize.length,
        entriesKept: historyToKeep.length,
        tokensBeforeCompaction: totalTokens,
        tokensAfterCompaction: summaryTokens + tokensToKeep,
        tokensSaved: tokensToSummarize - summaryTokens
      };
    } catch (error) {
      // Enhanced error logging with context
      console.error('Error in history compaction:', {
        error: error.message,
        agent: agent.name || 'unknown',
        command: agent.command,
        entriesToSummarize: historyToSummarize.length,
        totalTokens: totalTokens,
        timestamp: new Date().toISOString()
      });
      
      // Re-throw with more descriptive error message
      if (error.message.includes('timed out')) {
        throw new Error(`History compaction timed out after ${this.globalTimeout || agent.timeoutSeconds || 300} seconds. The AI agent may be unresponsive.`);
      } else if (error.message.includes('Agent command')) {
        throw new Error(`AI agent execution failed: ${error.message}`);
      } else if (error.message.includes('Failed to write')) {
        throw new Error(`File system error during compaction: ${error.message}`);
      } else {
        throw new Error(`History compaction failed: ${error.message}`);
      }
    }
  }
  
  /**
   * Fallback compaction method that truncates history without AI summarization
   * This is used when AI summarization fails completely
   * @param {number} keepPercentage - Percentage of history to keep (default: 50%)
   * @returns {object} Compaction statistics
   */
  fallbackCompactHistory(keepPercentage = 0.5) {
    const history = this.historyManager.readHistory();
    if (history.length === 0) {
      return {
        entriesSummarized: 0,
        entriesKept: 0,
        tokensBeforeCompaction: 0,
        tokensAfterCompaction: 0,
        tokensSaved: 0,
        method: 'fallback_truncation'
      };
    }
    
    // Calculate total token count
    const totalTokens = history.reduce((total, entry) => {
      return total + estimateTokenCount(entry.text);
    }, 0);
    
    // Find split point where we keep the specified percentage
    const targetTokens = Math.floor(totalTokens * keepPercentage);
    let cumulativeTokens = 0;
    let splitIndex = history.length;
    
    // Work backwards from the end to find where to keep from
    for (let i = history.length - 1; i >= 0; i--) {
      cumulativeTokens += estimateTokenCount(history[i].text);
      if (cumulativeTokens >= targetTokens) {
        splitIndex = i;
        break;
      }
    }
    
    // Ensure we always keep at least 1 entry
    splitIndex = Math.max(1, splitIndex);
    
    const historyToKeep = history.slice(splitIndex);
    const historyToRemove = history.slice(0, splitIndex);
    
    // Calculate token counts
    const tokensToKeep = historyToKeep.reduce((total, entry) => total + estimateTokenCount(entry.text), 0);
    const tokensToRemove = historyToRemove.reduce((total, entry) => total + estimateTokenCount(entry.text), 0);
    
    // Create a simple summary entry
    const summaryEntry = {
      sender: 'system',
      text: `[Fallback Compaction] Removed ${historyToRemove.length} older entries (${tokensToRemove} tokens) due to AI summarization failure. Kept ${historyToKeep.length} recent entries.`,
      timestamp: new Date().toISOString()
    };
    
    try {
      // Clear the existing history file
      this.historyManager.clearHistory();
      
      // Write the summary entry and the remaining history
      this.historyManager.writeHistory(summaryEntry);
      historyToKeep.forEach(entry => this.historyManager.writeHistory(entry));
    } catch (fileError) {
      throw new Error(`Failed to write fallback compacted history to file: ${fileError.message}`);
    }
    
    return {
      entriesSummarized: historyToRemove.length,
      entriesKept: historyToKeep.length,
      tokensBeforeCompaction: totalTokens,
      tokensAfterCompaction: estimateTokenCount(summaryEntry.text) + tokensToKeep,
      tokensSaved: tokensToRemove - estimateTokenCount(summaryEntry.text),
      method: 'fallback_truncation'
    };
  }

  /**
   * Manually compact the chat history by summarizing the oldest 50%
   * @param {object} agent - The agent to use for summarization
   * @returns {Promise<object>} Compaction statistics
   */
  async manualCompactHistory(agent) {
    try {
      return await this.compactHistory(agent);
    } catch (error) {
      console.error('Manual compaction failed, attempting fallback:', error.message);
      return this.fallbackCompactHistory(0.5);
    }
  }
}

module.exports = HistoryCompactor;