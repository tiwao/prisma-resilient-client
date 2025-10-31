/**
 * ResilientPrismaClient - Production-ready Prisma Client with auto-reconnect
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import type {
  ResilientConfig,
  ConnectionStats,
  HealthCheckResult,
  Logger,
  ErrorContext,
  ResilientPrismaEvents,
} from './types';
import {
  isRetryableError,
  getErrorMessage,
  calculateBackoff,
  sleep,
  getHeapUsagePercent,
  getMemoryInfo,
  triggerGC,
} from './utils';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<ResilientConfig, 'onError'>> = {
  reconnect: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoff: 'exponential',
  },
  refresh: {
    enabled: true,
    intervalMs: 5 * 60 * 1000, // 5 minutes
  },
  memory: {
    autoGC: true,
    gcThreshold: 0.85,
  },
  healthCheck: {
    enabled: true,
    intervalMs: 60 * 1000, // 1 minute
  },
  logging: {
    level: 'info',
    logger: console,
  },
};

/**
 * ResilientPrismaClient with automatic reconnection and connection management
 */
export class ResilientPrismaClient extends EventEmitter {
  private prisma: PrismaClient;
  private config: Required<Omit<ResilientConfig, 'onError'>> & Pick<ResilientConfig, 'onError'>;
  private logger: Logger;

  // Connection state
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private totalReconnects: number = 0;
  private lastSuccessfulConnection: Date | null = null;
  private queryCount: number = 0;
  private errorCount: number = 0;

  // Timers
  private refreshTimer: NodeJS.Timeout | null = null;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  /**
   * Create ResilientPrismaClient by wrapping an existing PrismaClient instance
   */
  constructor(prismaClient: PrismaClient, resilientConfig?: ResilientConfig) {
    super();

    this.prisma = prismaClient;

    // Merge configurations
    this.config = {
      ...DEFAULT_CONFIG,
      ...resilientConfig,
      reconnect: { ...DEFAULT_CONFIG.reconnect, ...resilientConfig?.reconnect },
      refresh: { ...DEFAULT_CONFIG.refresh, ...resilientConfig?.refresh },
      memory: { ...DEFAULT_CONFIG.memory, ...resilientConfig?.memory },
      healthCheck: { ...DEFAULT_CONFIG.healthCheck, ...resilientConfig?.healthCheck },
      logging: { ...DEFAULT_CONFIG.logging, ...resilientConfig?.logging },
      onError: resilientConfig?.onError,
    };

    this.logger = this.config.logging.logger || console;

    // Initialize connection
    this.initialize();
  }

  /**
   * Initialize connection and start background tasks
   */
  private async initialize(): Promise<void> {
    try {
      await this.connect();

      // Start periodic refresh
      if (this.config.refresh.enabled) {
        this.startPeriodicRefresh();
      }

      // Start health checks
      if (this.config.healthCheck.enabled) {
        this.startHealthChecks();
      }
    } catch (error) {
      this.log('error', 'Failed to initialize:', error);
    }
  }

  /**
   * Connect to database
   */
  private async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.connected = true;
      this.lastSuccessfulConnection = new Date();
      this.reconnectAttempts = 0;
      this.emit('connect');
      this.log('info', 'Connected to database');
    } catch (error) {
      this.connected = false;
      this.emit('disconnect', error as Error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  private async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.connected = false;
      this.log('info', 'Disconnected from database');
    } catch (error) {
      // Even if disconnect fails, mark as disconnected to allow reconnection
      this.connected = false;
      this.log('error', 'Error during disconnect:', error);
    }
  }

  /**
   * Ensure connection is established
   */
  private async ensureConnected(): Promise<void> {
    if (this.connected) {
      return;
    }

    this.log('debug', 'Connection lost, attempting to reconnect...');

    const maxAttempts = this.config.reconnect.maxAttempts || 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.reconnectAttempts = attempt;
      this.emit('reconnect', attempt);
      this.log('info', `Reconnection attempt ${attempt}/${maxAttempts}`);

      try {
        // Disconnect first to clean up
        await this.disconnect();

        // Wait with backoff
        const delay = calculateBackoff(
          attempt,
          this.config.reconnect.initialDelay || 1000,
          this.config.reconnect.maxDelay || 10000,
          this.config.reconnect.backoff || 'exponential'
        );
        this.log('debug', `Waiting ${delay}ms before reconnect...`);
        await sleep(delay);

        // Attempt connection
        await this.connect();

        this.totalReconnects++;
        this.emit('reconnect:success');
        this.log('info', 'Reconnection successful');
        return;
      } catch (error) {
        this.log('warn', `Reconnection attempt ${attempt} failed:`, error);

        if (attempt === maxAttempts) {
          this.emit('reconnect:failed', error as Error);
          throw new Error(`Failed to reconnect after ${maxAttempts} attempts: ${getErrorMessage(error)}`);
        }
      }
    }
  }

  /**
   * Execute operation with automatic reconnection
   */
  private async executeWithReconnect<T>(
    operation: () => Promise<T>,
    operationName: string = 'query'
  ): Promise<T> {
    const startTime = Date.now();

    try {
      // Ensure connected before operation
      await this.ensureConnected();

      // Execute operation
      const result = await operation();

      // Update stats
      this.queryCount++;
      const duration = Date.now() - startTime;
      this.log('debug', `${operationName} completed in ${duration}ms`);

      // Check memory and trigger GC if needed
      if (this.config.memory.autoGC) {
        const heapUsage = getHeapUsagePercent();
        const gcThreshold = this.config.memory.gcThreshold || 0.85;
        if (heapUsage >= gcThreshold) {
          this.log('warn', `High memory usage: ${(heapUsage * 100).toFixed(2)}%`);
          this.emit('memory:high', heapUsage * 100);

          if (triggerGC()) {
            this.emit('gc:executed');
            this.log('info', 'Garbage collection executed');
          }
        }
      }

      return result;
    } catch (error) {
      this.errorCount++;
      const duration = Date.now() - startTime;

      this.log('error', `${operationName} failed:`, error);

      // Call custom error handler
      if (this.config.onError) {
        const context: ErrorContext = {
          operation: operationName,
          retryCount: this.reconnectAttempts,
          duration,
        };
        await this.config.onError(error as Error, context);
      }

      // If it's a connection error, mark as disconnected and retry
      if (isRetryableError(error)) {
        this.connected = false;
        this.emit('disconnect', error as Error);
        this.log('warn', 'Connection error detected, attempting reconnect...');

        // Retry with reconnection
        await this.ensureConnected();
        return await operation();
      }

      // Non-retryable error, throw immediately
      throw error;
    }
  }

  /**
   * Start periodic connection refresh
   */
  private startPeriodicRefresh(): void {
    this.refreshTimer = setInterval(async () => {
      this.log('debug', 'Performing periodic connection refresh...');
      try {
        // Mark as disconnected first to ensure clean state
        this.connected = false;

        // Disconnect old connection (ignore errors)
        await this.disconnect();

        // Reconnect using ensureConnected for robust retry logic
        await this.ensureConnected();

        this.log('info', 'Connection refreshed successfully');
      } catch (error) {
        this.log('error', 'Failed to refresh connection:', error);
        // Ensure we're marked as disconnected so next operation will retry
        this.connected = false;
      }
    }, this.config.refresh.intervalMs || 300000);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.healthCheck();
        if (health.status === 'unhealthy') {
          this.log('warn', 'Health check failed:', health.error);
        }
      } catch (error) {
        this.log('error', 'Health check error:', error);
      }
    }, this.config.healthCheck.intervalMs || 60000);
  }

  /**
   * Logging helper
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logging.level || 'info');
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      this.logger[level](`[ResilientPrismaClient] ${message}`, ...args);
    }
  }

  // Public API

  /**
   * Check if currently connected to database
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): ConnectionStats {
    const uptime = this.lastSuccessfulConnection
      ? Date.now() - this.lastSuccessfulConnection.getTime()
      : 0;

    return {
      isConnected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      totalReconnects: this.totalReconnects,
      lastSuccessfulConnection: this.lastSuccessfulConnection?.toISOString() || null,
      uptime,
      queryCount: this.queryCount,
      errorCount: this.errorCount,
    };
  }

  /**
   * Perform health check
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        database: 'connected',
        latency,
        memory: getMemoryInfo(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Manually trigger reconnection
   */
  public async reconnect(): Promise<void> {
    this.connected = false;
    await this.ensureConnected();
  }

  /**
   * Clean shutdown
   */
  public async shutdown(): Promise<void> {
    this.log('info', 'Shutting down...');

    // Clear timers
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Disconnect
    await this.disconnect();

    this.log('info', 'Shutdown complete');
  }

  /**
   * Get the underlying Prisma client with automatic reconnection wrapper
   */
  public getClient(): PrismaClient {
    // Return a Proxy that wraps all methods with reconnection logic
    return new Proxy(this.prisma, {
      get: (target: any, prop: string) => {
        const original = target[prop];

        // If it's a model delegate (user, session, etc.)
        if (typeof original === 'object' && original !== null && !prop.startsWith('$')) {
          return new Proxy(original, {
            get: (modelTarget: any, modelProp: string) => {
              const modelMethod = modelTarget[modelProp];

              // If it's a method, wrap it
              if (typeof modelMethod === 'function') {
                return (...args: any[]) => {
                  return this.executeWithReconnect(
                    async () => await modelMethod.apply(modelTarget, args),
                    `${prop}.${modelProp}`
                  );
                };
              }

              return modelMethod;
            },
          });
        }

        // If it's a special Prisma method ($connect, $disconnect, etc.)
        if (typeof original === 'function' && prop.startsWith('$')) {
          if (prop === '$connect') {
            return () => this.connect();
          }
          if (prop === '$disconnect') {
            return () => this.disconnect();
          }

          // Wrap other $ methods with reconnection
          return (...args: any[]) => {
            return this.executeWithReconnect(
              async () => await original.apply(target, args),
              prop
            );
          };
        }

        return original;
      },
    }) as PrismaClient;
  }

  /**
   * Type-safe event listeners
   */
  public on<K extends keyof ResilientPrismaEvents>(
    event: K,
    listener: ResilientPrismaEvents[K]
  ): this {
    return super.on(event, listener);
  }

  public once<K extends keyof ResilientPrismaEvents>(
    event: K,
    listener: ResilientPrismaEvents[K]
  ): this {
    return super.once(event, listener);
  }

  public emit<K extends keyof ResilientPrismaEvents>(
    event: K,
    ...args: Parameters<ResilientPrismaEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
