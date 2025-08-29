const { estimateTokenCount } = require('../utils/tokenEstimator.cjs');

class AgentStatusManager {
  constructor(configManager, historyManager, historyCompactor) {
    this.configManager = configManager;
    this.historyManager = historyManager;
    this.historyCompactor = historyCompactor;
  }

  /**
   * Get the context usage percentage left for a given agent.
   * @param {object} agent - The agent object.
   * @returns {number} Percentage of context window left (0-100).
   */
  getContextUsagePercentageLeft(agent) {
    const history = this.historyManager.readHistory();
    const totalTokenCount = history.reduce((total, entry) => {
      return total + estimateTokenCount(entry.text);
    }, 0);

    const contextWindow = agent.contextWindowTokens;
    if (!contextWindow || contextWindow <= 0) {
      return 0; // No context window defined or invalid
    }

    const tokensLeft = contextWindow - totalTokenCount;
    const percentage = (tokensLeft / contextWindow) * 100;
    return Math.max(0, Math.min(100, Math.round(percentage)));
  }

  /**
   * Get the color code for the percentage.
   * @param {number} percentage - The percentage value.
   * @returns {string} Blessed color tag (e.g., '{green-fg}', '{yellow-fg}', '{red-fg}').
   */
  getPercentageColor(percentage) {
    if (percentage >= 50) {
      return 'green';
    } else if (percentage >= 25) {
      return 'yellow';
    } else {
      return 'red';
    }
  }

  /**
   * Deterministically map an agent name to a distinct color (hex string)
   * Matches the palette behavior used in the UI agent announcements
   * @param {string} agentName
   * @returns {string} Color string (can be hex like #FF6B6B)
   */
  getAgentColor(agentName) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
      '#FF8A80', '#80CBC4', '#81C784', '#FFB74D', '#F06292', '#9575CD',
      '#4FC3F7', '#AED581', '#FFD54F', '#A1887F', '#90A4AE', '#EF5350',
      '#26A69A', '#AB47BC', '#5C6BC0', '#42A5F5', '#66BB6A', '#FFCA28',
      '#FF7043', '#8D6E63', '#78909C', '#EC407A', '#7E57C2', '#29B6F6',
      '#FFAB91', '#C5E1A5', '#FFF176', '#BCAAA4', '#B0BEC5', '#FFCDD2',
      '#E1BEE7', '#C8E6C9', '#FFF9C4', '#D7CCC8', '#CFD8DC', '#FFCCBC'
    ];
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      hash = ((hash << 5) - hash) + agentName.charCodeAt(i);
      hash |= 0;
    }
    return colors[Math.abs(hash) % colors.length];
  }

  /**
   * Get the formatted status string for all agents. This string is right-aligned.
   * @param {string|null} currentAgentName - The name of the currently active agent, or null if none.
   * @param {number} totalWidth - The total width of the info line box.
   * @returns {string} The formatted string for the info line.
   */
  getFormattedAgentStatus(currentAgentName = null, totalWidth = 0) {
    const enabledAgents = this.configManager.getEnabledAgents();
    const parts = [];

    // Preferred icon: File cabinet (🗄)
    const icon = '🗄';
    for (const agent of enabledAgents) {
      const percentageLeft = this.getContextUsagePercentageLeft(agent);
      const pctColor = this.getPercentageColor(percentageLeft);
      const agentColor = this.getAgentColor(agent.name);
      const indicator = (currentAgentName === agent.name) ? '•' : '';

      // Construct with explicit spaces to avoid tag adjacency issues
      const left = indicator ? `${indicator} ` : '';
      const iconPart = `{${agentColor}-fg}${icon}{/${agentColor}-fg}`;
      const pctPart = `{${pctColor}-fg}${percentageLeft}%{/${pctColor}-fg}`;
      const segment = `${left}${iconPart} ${pctPart}`;
      parts.push(segment);
    }

    // Join with a single space between agents
    const content = parts.join(' ');

    // If width is provided we still right-pad manually; otherwise return as-is.
    if (!totalWidth || totalWidth <= 0) {
      return content;
    }
    // Let the widget handle right alignment via align:'right'.
    return content;
  }
}

module.exports = AgentStatusManager;
