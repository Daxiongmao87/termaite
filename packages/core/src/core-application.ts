import { EventEmitter } from 'eventemitter3';
import type { CoreConfig } from './types/index.js';

export interface CoreApplicationOptions {
  config?: Partial<CoreConfig>;
  configPath?: string;
  debug?: boolean;
}

export class CoreApplication extends EventEmitter {
  private config: CoreConfig | null = null;
  private isInitialized = false;
  private isShuttingDown = false;

  constructor(private options: CoreApplicationOptions = {}) {
    super();
    this.setupErrorHandling();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('CoreApplication is already initialized');
    }

    try {
      // TODO: Load configuration
      this.emit('initializing');
      
      // TODO: Initialize services
      // - Configuration service
      // - Agent service
      // - LLM service
      // - Command service
      // - Communication service
      
      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isInitialized || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.emit('shutting-down');

    try {
      // TODO: Shutdown services gracefully
      // - Close connections
      // - Save state
      // - Clean up resources
      
      this.isInitialized = false;
      this.emit('shutdown');
      
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  getConfig(): CoreConfig | null {
    return this.config;
  }

  isReady(): boolean {
    return this.isInitialized && !this.isShuttingDown;
  }

  private setupErrorHandling(): void {
    process.on('uncaughtException', (error) => {
      this.emit('error', error);
    });

    process.on('unhandledRejection', (reason) => {
      this.emit('error', reason);
    });

    process.on('SIGINT', () => {
      this.shutdown().catch((error) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      this.shutdown().catch((error) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
    });
  }
}
