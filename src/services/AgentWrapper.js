const { spawn } = require('child_process');

class AgentWrapper {
  /**
   * Executes an agent command with timeout and I/O piping
   * @param {string} command - The command to execute
   * @param {string} input - The input to pipe to the command
   * @param {number} timeoutSeconds - The timeout in seconds
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  static async executeAgentCommand(command, input, timeoutSeconds) {
    return new Promise((resolve, reject) => {
      const timeoutMs = timeoutSeconds * 1000;
      let timeoutId;
      
      // Spawn the process
      const process = spawn(command, { shell: true });
      
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
        reject(new Error(`Agent command timed out after ${timeoutSeconds} seconds`));
      }, timeoutMs);
      
      // Pipe input to the process
      if (input) {
        process.stdin.write(input);
        process.stdin.end();
      }
    });
  }
}

module.exports = AgentWrapper;