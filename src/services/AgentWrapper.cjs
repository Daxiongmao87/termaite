const { spawn } = require('child_process');

class AgentWrapper {
  /**
   * Executes an agent command with timeout and I/O piping
   * @param {object} agent - The agent object containing command and timeout
   * @param {string} input - The input to pipe to the command
   * @param {array} history - The chat history
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  static async executeAgentCommand(agent, input, history) {
    // Augment the prompt with a request for a summary
    const augmentedInput = this.augmentPrompt(input, history);
    
    return new Promise((resolve, reject) => {
      const timeoutMs = (agent.timeoutSeconds || 30) * 1000;
      let timeoutId;
      
      // Spawn the process
      const process = spawn(agent.command, { shell: true });
      
      let stdout = '';
      let stderr = '';
      
      // Collect stdout
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      // Collect stderr
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process close
      process.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({ stdout, stderr, exitCode: code });
      });
      
      // Handle process error
      process.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
      
      // Set timeout
      timeoutId = setTimeout(() => {
        process.kill();
        reject(new Error(`Agent command timed out after ${agent.timeoutSeconds || 30} seconds`));
      }, timeoutMs);
      
      // Pipe input to the process with error handling
      if (augmentedInput) {
        process.stdin.on('error', (error) => {
          // Ignore EPIPE errors which can occur if the process exits before stdin is fully written
          if (error.code !== 'EPIPE') {
            console.error('Error writing to agent stdin:', error);
          }
        });
        
        try {
          process.stdin.write(augmentedInput);
          process.stdin.end();
        } catch (error) {
          // Handle synchronous write errors
          if (error.code !== 'EPIPE') {
            console.error('Error writing to agent stdin:', error);
          }
        }
      }
    });
  }

  /**
   * Augment the prompt with a request for a summary
   * @param {string} input - The user's input
   * @param {array} history - The chat history
   * @returns {string} The augmented prompt
   */
  static augmentPrompt(input, history) {
    let augmentedInput = '';
    
    // If there's history, include a summary of it for context
    if (history && history.length > 0) {
      augmentedInput += '=== Previous conversation context ===\n';
      // Include last few exchanges for context (limit to prevent overwhelming the agent)
      const recentHistory = history.slice(-10); // Last 10 messages
      recentHistory.forEach(entry => {
        augmentedInput += `${entry.sender}: ${entry.text.substring(0, 200)}${entry.text.length > 200 ? '...' : ''}\n`;
      });
      augmentedInput += '=== End of context ===\n\n';
    }
    
    // Add the current user input
    augmentedInput += `Current request: ${input}`;
    
    // Add a request for a summary at the end
    augmentedInput += '\n\nIMPORTANT: After completing this task, please provide a comprehensive summary of your actions and conclusions.';
    
    return augmentedInput;
  }
}

module.exports = AgentWrapper;