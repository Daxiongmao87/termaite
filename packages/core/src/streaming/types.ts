import { EventEmitter } from 'events';
import { StreamEvent, StreamEventType, AgentType } from '../types/index.js';

/**
 * Stream state enumeration
 */
export enum StreamStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETING = 'completing',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

/**
 * Stream event priority levels
 */
export enum StreamPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Enhanced stream event interface with metadata
 */
export interface EnhancedStreamEvent extends StreamEvent {
  /** Unique event identifier */
  id: string;
  
  /** Event priority level */
  priority: StreamPriority;
  
  /** Source of the event */
  source: string;
  
  /** Event sequence number */
  sequence: number;
  
  /** Related event IDs for correlation */
  correlationId?: string;
  
  /** Event metadata */
  metadata?: {
    duration?: number;
    retryCount?: number;
    tags?: string[];
    [key: string]: any;
  };
}

/**
 * Stream subscription interface
 */
export interface StreamSubscription {
  /** Subscription ID */
  id: string;
  
  /** Event types to listen for */
  eventTypes: StreamEventType[];
  
  /** Callback function */
  callback: (event: EnhancedStreamEvent) => void | Promise<void>;
  
  /** Subscription options */
  options?: {
    once?: boolean;
    priority?: StreamPriority;
    filter?: (event: EnhancedStreamEvent) => boolean;
  };
  
  /** Subscription metadata */
  metadata: {
    createdAt: number;
    lastEventAt?: number;
    eventCount: number;
    isActive: boolean;
  };
}

/**
 * Stream statistics interface
 */
export interface StreamStats {
  /** Current stream state */
  status: StreamStatus;
  
  /** Total events processed */
  totalEvents: number;
  
  /** Events by type */
  eventsByType: Record<StreamEventType, number>;
  
  /** Active subscriptions count */
  activeSubscriptions: number;
  
  /** Stream start time */
  startTime?: number;
  
  /** Last event time */
  lastEventTime?: number;
  
  /** Error count */
  errorCount: number;
  
  /** Performance metrics */
  performance: {
    eventsPerSecond: number;
    avgProcessingTime: number;
    peakMemoryUsage: number;
  };
}

/**
 * Async iterator interface for streaming data
 */
export interface StreamIterator<T> extends AsyncIterableIterator<T> {
  /** Check if the iterator has more values */
  hasNext(): Promise<boolean>;
  
  /** Cancel the iteration */
  cancel(): Promise<void>;
  
  /** Get current position/progress */
  getPosition(): number;
  
  /** Get total count if known */
  getTotal(): number | null;
}

/**
 * Stream processor interface for handling different event types
 */
export interface StreamProcessor<T = any> {
  /** Process an event */
  process(event: EnhancedStreamEvent): Promise<T>;
  
  /** Check if processor can handle event type */
  canHandle(eventType: StreamEventType): boolean;
  
  /** Get processor metadata */
  getMetadata(): {
    name: string;
    version: string;
    supportedTypes: StreamEventType[];
  };
}

/**
 * Stream buffer interface for managing event queues
 */
export interface StreamBuffer {
  /** Add event to buffer */
  push(event: EnhancedStreamEvent): Promise<void>;
  
  /** Get next event from buffer */
  pop(): Promise<EnhancedStreamEvent | null>;
  
  /** Peek at next event without removing */
  peek(): Promise<EnhancedStreamEvent | null>;
  
  /** Get buffer size */
  size(): number;
  
  /** Check if buffer is empty */
  isEmpty(): boolean;
  
  /** Clear all events */
  clear(): Promise<void>;
  
  /** Get buffer statistics */
  getStats(): {
    size: number;
    capacity: number;
    droppedEvents: number;
    oldestEvent?: number;
    newestEvent?: number;
  };
}

/**
 * Stream configuration interface
 */
export interface StreamConfig {
  /** Maximum buffer size */
  maxBufferSize: number;
  
  /** Event processing timeout */
  processingTimeout: number;
  
  /** Enable event persistence */
  enablePersistence: boolean;
  
  /** Maximum retries for failed events */
  maxRetries: number;
  
  /** Batch processing size */
  batchSize: number;
  
  /** Stream priority levels */
  priorityLevels: StreamPriority[];
  
  /** Performance monitoring */
  monitoring: {
    enabled: boolean;
    samplingRate: number;
    metricsInterval: number;
  };
  
  /** Debug options */
  debug: {
    enabled: boolean;
    logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    logEvents: boolean;
  };
}

/**
 * Base class for stream management
 */
export abstract class BaseStreamManager extends EventEmitter {
  protected config: StreamConfig;
  protected status: StreamStatus = StreamStatus.IDLE;
  protected subscriptions: Map<string, StreamSubscription> = new Map();
  protected processors: Map<StreamEventType, StreamProcessor[]> = new Map();
  protected stats: StreamStats;
  protected eventSequence: number = 0;
  
  constructor(config: Partial<StreamConfig> = {}) {
    super();
    this.config = this.mergeConfig(config);
    this.stats = this.initializeStats();
  }
  
  /**
   * Get current stream status
   */
  getStatus(): StreamStatus {
    return this.status;
  }
  
  /**
   * Get stream statistics
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }
  
  /**
   * Subscribe to stream events
   */
  subscribe(
    eventTypes: StreamEventType | StreamEventType[],
    callback: (event: EnhancedStreamEvent) => void | Promise<void>,
    options?: StreamSubscription['options']
  ): string {
    const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
    const subscription: StreamSubscription = {
      id: this.generateId(),
      eventTypes: types,
      callback,
      options,
      metadata: {
        createdAt: Date.now(),
        eventCount: 0,
        isActive: true
      }
    };
    
    this.subscriptions.set(subscription.id, subscription);
    this.stats.activeSubscriptions = this.subscriptions.size;
    
    return subscription.id;
  }
  
  /**
   * Unsubscribe from stream events
   */
  unsubscribe(subscriptionId: string): boolean {
    const success = this.subscriptions.delete(subscriptionId);
    this.stats.activeSubscriptions = this.subscriptions.size;
    return success;
  }
  
  /**
   * Register a stream processor
   */
  registerProcessor(processor: StreamProcessor): void {
    const metadata = processor.getMetadata();
    
    for (const eventType of metadata.supportedTypes) {
      if (!this.processors.has(eventType)) {
        this.processors.set(eventType, []);
      }
      this.processors.get(eventType)!.push(processor);
    }
  }
  
  /**
   * Emit an enhanced stream event
   */
  protected async emitStreamEvent(
    type: StreamEventType,
    data: any,
    source: string = 'unknown',
    priority: StreamPriority = StreamPriority.NORMAL
  ): Promise<void> {
    const event: EnhancedStreamEvent = {
      id: this.generateId(),
      type,
      data,
      timestamp: Date.now(),
      priority,
      source,
      sequence: ++this.eventSequence
    };
    
    await this.processEvent(event);
  }
  
  /**
   * Process a stream event
   */
  protected async processEvent(event: EnhancedStreamEvent): Promise<void> {
    // Ensure event type is valid
    const eventType = event.type as StreamEventType;
    
    // Update statistics
    this.stats.totalEvents++;
    this.stats.eventsByType[eventType] = (this.stats.eventsByType[eventType] || 0) + 1;
    this.stats.lastEventTime = event.timestamp;
    
    // Notify subscribers
    await this.notifySubscribers(event);
    
    // Process with registered processors
    await this.runProcessors(event);
  }
  
  /**
   * Notify event subscribers
   */
  protected async notifySubscribers(event: EnhancedStreamEvent): Promise<void> {
    const promises: Promise<void>[] = [];
    const eventType = event.type as StreamEventType;
    
    for (const subscription of this.subscriptions.values()) {
      if (!subscription.metadata.isActive) continue;
      
      // Check if subscription handles this event type
      if (!subscription.eventTypes.includes(eventType)) continue;
      
      // Apply filter if present
      if (subscription.options?.filter && !subscription.options.filter(event)) continue;
      
      // Update subscription metadata
      subscription.metadata.lastEventAt = event.timestamp;
      subscription.metadata.eventCount++;
      
      // Execute callback
      const promise = this.executeCallback(subscription, event);
      promises.push(promise);
      
      // Remove subscription if it's a one-time listener
      if (subscription.options?.once) {
        this.subscriptions.delete(subscription.id);
      }
    }
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Execute subscription callback
   */
  protected async executeCallback(
    subscription: StreamSubscription,
    event: EnhancedStreamEvent
  ): Promise<void> {
    try {
      await subscription.callback(event);
    } catch (error) {
      this.stats.errorCount++;
      this.emit('subscriptionError', { subscription, event, error });
    }
  }
  
  /**
   * Run event processors
   */
  protected async runProcessors(event: EnhancedStreamEvent): Promise<void> {
    const eventType = event.type as StreamEventType;
    const processors = this.processors.get(eventType) || [];
    
    const promises = processors.map(async processor => {
      try {
        await processor.process(event);
      } catch (error) {
        this.stats.errorCount++;
        this.emit('processorError', { processor, event, error });
      }
    });
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Merge configuration with defaults
   */
  protected mergeConfig(config: Partial<StreamConfig>): StreamConfig {
    const defaults: StreamConfig = {
      maxBufferSize: 1000,
      processingTimeout: 5000,
      enablePersistence: false,
      maxRetries: 3,
      batchSize: 10,
      priorityLevels: [StreamPriority.LOW, StreamPriority.NORMAL, StreamPriority.HIGH, StreamPriority.CRITICAL],
      monitoring: {
        enabled: true,
        samplingRate: 0.1,
        metricsInterval: 10000
      },
      debug: {
        enabled: false,
        logLevel: 'info',
        logEvents: false
      }
    };
    
    return { ...defaults, ...config };
  }
  
  /**
   * Initialize statistics
   */
  protected initializeStats(): StreamStats {
    return {
      status: StreamStatus.IDLE,
      totalEvents: 0,
      eventsByType: {} as Record<StreamEventType, number>,
      activeSubscriptions: 0,
      errorCount: 0,
      performance: {
        eventsPerSecond: 0,
        avgProcessingTime: 0,
        peakMemoryUsage: 0
      }
    };
  }
  
  /**
   * Abstract methods for implementation
   */
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
}

export default BaseStreamManager;
