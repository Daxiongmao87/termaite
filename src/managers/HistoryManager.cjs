const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class HistoryManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectSlug = this.createProjectSlug(projectPath);
    this.historyPath = this.getHistoryPath();
    this.userInputsPath = this.getUserInputsPath();
    this.ensureHistoryDirExists();
  }

  /**
   * Create a filesystem-safe slug from the project path
   * @param {string} projectPath - The project path
   * @returns {string} The project slug
   */
  createProjectSlug(projectPath) {
    // Get the absolute path to ensure consistency
    const absolutePath = path.resolve(projectPath);
    // Replace slashes with dashes, following Claude's naming convention
    // e.g., /home/patrick/Projects/term.ai.te becomes -home-patrick-Projects-term.ai.te
    return absolutePath.replace(/\//g, '-');
  }

  /**
   * Get the path to the history file for the current project
   * @returns {string} The path to the history file
   */
  getHistoryPath() {
    return path.join(os.homedir(), '.termaite', 'projects', this.projectSlug, 'history.jsonl');
  }

  /**
   * Get the path to the user inputs file for the current project
   * @returns {string} The path to the user inputs file
   */
  getUserInputsPath() {
    return path.join(os.homedir(), '.termaite', 'projects', this.projectSlug, 'user_inputs.jsonl');
  }

  /**
   * Ensure the history directory exists
   */
  ensureHistoryDirExists() {
    const historyDir = path.dirname(this.historyPath);
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
  }

  /**
   * Read the chat history from the history file
   * @returns {array} The chat history
   */
  readHistory() {
    try {
      if (!fs.existsSync(this.historyPath)) {
        return [];
      }
      
      const data = fs.readFileSync(this.historyPath, 'utf8');
      const lines = data.split('\n').filter(line => line.trim() !== '');
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      console.error('Error reading history:', error);
      return [];
    }
  }

  /**
   * Write a new entry to the chat history
   * @param {object} entry - The entry to write
   */
  writeHistory(entry) {
    try {
      fs.appendFileSync(this.historyPath, JSON.stringify(entry) + '\n');
    } catch (error) {
      console.error('Error writing history:', error);
    }
  }

  /**
   * Clear the chat history
   */
  clearHistory() {
    try {
      if (fs.existsSync(this.historyPath)) {
        fs.unlinkSync(this.historyPath);
      }
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }

  /**
   * Replace the history with new entries
   * @param {array} entries - The new history entries
   */
  replaceHistory(entries) {
    try {
      // Clear existing history
      this.clearHistory();
      // Write all new entries
      entries.forEach(entry => this.writeHistory(entry));
    } catch (error) {
      console.error('Error replacing history:', error);
    }
  }

  /**
   * Get the most recently used project
   * @returns {string|null} The path to the most recently used project or null
   */
  static getMostRecentProject() {
    const projectsDir = path.join(os.homedir(), '.termaite', 'projects');
    
    if (!fs.existsSync(projectsDir)) {
      return null;
    }

    try {
      const projects = fs.readdirSync(projectsDir, { withFileTypes: true });
      let mostRecent = null;
      let mostRecentTime = 0;

      for (const project of projects) {
        // Only process directories
        if (!project.isDirectory()) {
          continue;
        }
        
        const historyPath = path.join(projectsDir, project.name, 'history.jsonl');
        if (fs.existsSync(historyPath)) {
          const stats = fs.statSync(historyPath);
          if (stats.mtime.getTime() > mostRecentTime) {
            mostRecentTime = stats.mtime.getTime();
            mostRecent = historyPath;
          }
        }
      }

      return mostRecent;
    } catch (error) {
      console.error('Error getting most recent project:', error);
      return null;
    }
  }

  /**
   * Load history from a specific path
   * @param {string} historyPath - The path to the history file
   * @returns {array} The history array
   */
  static loadHistoryFromPath(historyPath) {
    try {
      if (!fs.existsSync(historyPath)) {
        return [];
      }
      
      const data = fs.readFileSync(historyPath, 'utf8');
      const lines = data.split('\n').filter(line => line.trim() !== '');
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      console.error('Error loading history from path:', error);
      return [];
    }
  }

  /**
   * Remove the last entry from history (used for cancellation)
   */
  removeLastEntry() {
    const history = this.readHistory();
    if (history.length > 0) {
      history.pop();
      // Rewrite the entire history file without the last entry
      if (fs.existsSync(this.historyPath)) {
        fs.writeFileSync(this.historyPath, '');
      }
      history.forEach(entry => {
        this.writeHistory(entry);
      });
    }
  }

  /**
   * Write user input to both chat history and dedicated user inputs file
   * @param {string} text - The user input text
   */
  writeUserInput(text) {
    // Write to user inputs file for arrow navigation
    this.appendToUserInputsFile(text);
    
    // Also write to main chat history for context
    this.writeHistory({
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Append text to user inputs file
   * @param {string} text - The text to append
   */
  appendToUserInputsFile(text) {
    try {
      const entry = text + '\n';
      fs.appendFileSync(this.userInputsPath, entry);
    } catch (error) {
      console.error('Error writing user input:', error);
    }
  }

  /**
   * Read user inputs from the user inputs file
   * @returns {array} Array of user input strings
   */
  readUserInputs() {
    try {
      if (!fs.existsSync(this.userInputsPath)) {
        return [];
      }
      
      const content = fs.readFileSync(this.userInputsPath, 'utf8');
      return content
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.trim());
    } catch (error) {
      console.error('Error reading user inputs:', error);
      return [];
    }
  }

  /**
   * Clear user inputs file
   */
  clearUserInputs() {
    try {
      if (fs.existsSync(this.userInputsPath)) {
        fs.unlinkSync(this.userInputsPath);
      }
    } catch (error) {
      console.error('Error clearing user inputs:', error);
    }
  }
}

module.exports = HistoryManager;