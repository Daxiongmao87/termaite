const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class HistoryManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectSlug = this.createProjectSlug(projectPath);
    this.historyPath = this.getHistoryPath();
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
    // Create a hash of the full path to ensure uniqueness
    const hash = crypto.createHash('md5').update(absolutePath).digest('hex');
    // Get the basename for readability
    const basename = path.basename(absolutePath);
    // Create a safe slug from basename
    const safeBasename = basename.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    // Combine basename with first 8 chars of hash for uniqueness
    return `${safeBasename}_${hash.substring(0, 8)}`;
  }

  /**
   * Get the path to the history file for the current project
   * @returns {string} The path to the history file
   */
  getHistoryPath() {
    return path.join(os.homedir(), '.termaite', 'projects', this.projectSlug, 'history.jsonl');
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
      const projects = fs.readdirSync(projectsDir);
      let mostRecent = null;
      let mostRecentTime = 0;

      for (const project of projects) {
        const historyPath = path.join(projectsDir, project, 'history.jsonl');
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
}

module.exports = HistoryManager;