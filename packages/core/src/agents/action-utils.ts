/**
 * Command execution utilities for Action Agent
 * Extracted to keep files under 500-line limit
 */

import type { CommandResult, CommandPermission, OperationMode, CoreConfig } from '../types/index.js';

/**
 * Command executor utility class
 */
export class CommandExecutor {
  private readonly config: CoreConfig;

  constructor(config: CoreConfig) {
    this.config = config;
  }

  /**
   * Execute a command and return structured result
   */
  async execute(command: string): Promise<CommandResult> {
    try {
      // Use Node.js child_process to execute the command
      const { spawn } = await import('child_process');
      const timeout = this.config.commands.timeout;

      return new Promise((resolve) => {
        const process = spawn('sh', ['-c', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', (code) => {
          const result: CommandResult = {
            success: code === 0,
            output: stdout.trim() || stderr.trim(),
            error: code !== 0 ? stderr.trim() : undefined,
            exitCode: code || 0,
            duration: Date.now() // Simplified duration tracking
          };

          resolve(result);
        });

        process.on('error', (error) => {
          resolve({
            success: false,
            output: '',
            error: error.message,
            exitCode: -1,
            duration: Date.now()
          });
        });

        // Handle timeout
        setTimeout(() => {
          process.kill('SIGTERM');
          resolve({
            success: false,
            output: '',
            error: `Command timed out after ${timeout}ms`,
            exitCode: -1,
            duration: timeout
          });
        }, timeout);
      });

    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown execution error',
        exitCode: -1,
        duration: 0
      };
    }
  }
}

/**
 * Command permission checker utility class
 */
export class CommandPermissionChecker {
  private readonly config: CoreConfig;

  constructor(config: CoreConfig) {
    this.config = config;
  }

  /**
   * Check if a command is permitted to execute
   */
  async checkPermission(command: string, mode: OperationMode): Promise<CommandPermission> {
    const commandName = this.extractCommandName(command);

    // Check blacklist first
    if (this.config.commands.blacklistedCommands.includes(commandName)) {
      return {
        command: commandName,
        allowed: false,
        reason: `Command '${commandName}' is blacklisted`
      };
    }

    // Check allowed commands in normal mode
    if (mode === 'normal') {
      if (!this.config.commands.allowedCommands[commandName]) {
        return {
          command: commandName,
          allowed: false,
          reason: `Command '${commandName}' is not in allowed list`
        };
      }
    }

    // In gremlin/goblin modes, more commands are allowed
    return {
      command: commandName,
      allowed: true,
      reason: 'Command is permitted'
    };
  }

  /**
   * Extract the base command name from a full command string
   */
  private extractCommandName(command: string): string {
    const parts = command.trim().split(/\s+/);
    return parts[0] || '';
  }
}

/**
 * Action utilities for common operations
 */
export class ActionUtils {
  /**
   * Parse action response and extract components
   */
  static parseActionComponents(response: string): {
    thought?: string;
    summary?: string;
    command?: string;
    textResponse?: string;
  } {
    const thought = response.match(/<think>(.*?)<\/think>/s)?.[1]?.trim();
    const summary = response.match(/<summary>(.*?)<\/summary>/s)?.[1]?.trim();
    const command = response.match(/```agent_command\s*\n(.*?)\n```/s)?.[1]?.trim();
    
    // Extract text response (removing think tags)
    const textResponse = response.replace(/<think>.*?<\/think>/gs, '').trim();

    return { thought, summary, command, textResponse };
  }

  /**
   * Validate command safety
   */
  static isCommandSafe(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // rm -rf /
      /dd\s+if=/, // dd commands
      /mkfs/, // filesystem creation
      /fdisk/, // disk partitioning
      /:\(\)\{.*\}\;:/, // fork bombs
    ];

    return !dangerousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Format command result for display
   */
  static formatCommandResult(result: CommandResult): string {
    if (result.success) {
      return `✅ Command executed successfully (exit code: ${result.exitCode})\nOutput:\n${result.output || '(no output)'}`;
    } else {
      return `❌ Command failed (exit code: ${result.exitCode})\nError:\n${result.error || 'Unknown error'}`;
    }
  }

  /**
   * Create standardized action taken message
   */
  static createActionMessage(command: string, executed: boolean = false): string {
    if (executed) {
      return `Executed command: ${command}`;
    } else {
      return `Command ready for execution: ${command}`;
    }
  }
}
