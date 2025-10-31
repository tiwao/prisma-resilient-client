/**
 * Configuration options for ResilientPrismaClient
 */
export interface ResilientConfig {
  /**
   * Reconnection settings
   */
  reconnect?: {
    /**
     * Maximum number of reconnection attempts
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Initial delay in milliseconds before first retry
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Maximum delay in milliseconds between retries
     * @default 10000
     */
    maxDelay?: number;

    /**
     * Backoff strategy for retry delays
     * - linear: delay increases linearly (initialDelay * attempt)
     * - exponential: delay doubles each time (initialDelay * 2^attempt)
     * @default 'exponential'
     */
    backoff?: 'linear' | 'exponential';
  };

  /**
   * Periodic connection refresh settings
   */
  refresh?: {
    /**
     * Enable periodic connection refresh
     * @default true
     */
    enabled?: boolean;

    /**
     * Interval in milliseconds between refreshes
     * @default 300000 (5 minutes)
     */
    intervalMs?: number;
  };

  /**
   * Memory management settings
   */
  memory?: {
    /**
     * Enable automatic garbage collection
     * @default true
     */
    autoGC?: boolean;

    /**
     * Heap usage threshold (0-1) to trigger GC
     * @default 0.85
     */
    gcThreshold?: number;
  };

  /**
   * Health check settings
   */
  healthCheck?: {
    /**
     * Enable periodic health checks
     * @default true
     */
    enabled?: boolean;

    /**
     * Interval in milliseconds between health checks
     * @default 60000 (1 minute)
     */
    intervalMs?: number;
  };

  /**
   * Logging settings
   */
  logging?: {
    /**
     * Minimum log level
     * @default 'info'
     */
    level?: 'debug' | 'info' | 'warn' | 'error';

    /**
     * Custom logger instance
     * @default console
     */
    logger?: Logger;
  };

  /**
   * Custom error handler
   * Called when database errors occur
   */
  onError?: (error: Error, context: ErrorContext) => void | Promise<void>;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Error context passed to custom error handler
 */
export interface ErrorContext {
  /**
   * Name of the operation that failed
   */
  operation: string;

  /**
   * Number of retry attempts made
   */
  retryCount: number;

  /**
   * Duration of the operation in milliseconds
   */
  duration: number;
}

/**
 * Connection statistics
 */
export interface ConnectionStats {
  /**
   * Current connection state
   */
  isConnected: boolean;

  /**
   * Current number of reconnect attempts in progress
   */
  reconnectAttempts: number;

  /**
   * Total number of successful reconnects since start
   */
  totalReconnects: number;

  /**
   * Timestamp of last successful connection
   */
  lastSuccessfulConnection: string | null;

  /**
   * Uptime in milliseconds since last successful connection
   */
  uptime: number;

  /**
   * Total number of queries executed
   */
  queryCount: number;

  /**
   * Total number of errors encountered
   */
  errorCount: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /**
   * Overall health status
   */
  status: 'healthy' | 'unhealthy';

  /**
   * Database connection status
   */
  database: 'connected' | 'disconnected';

  /**
   * Query latency in milliseconds (only when healthy)
   */
  latency?: number;

  /**
   * Memory usage information (only when healthy)
   */
  memory?: {
    heapUsed: string;
    heapTotal: string;
    heapUsagePercent: string;
  };

  /**
   * Error message (only when unhealthy)
   */
  error?: string;
}

/**
 * Events emitted by ResilientPrismaClient
 */
export interface ResilientPrismaEvents {
  /**
   * Emitted when successfully connected to database
   */
  connect: () => void;

  /**
   * Emitted when disconnected from database
   */
  disconnect: (error?: Error) => void;

  /**
   * Emitted when reconnection attempt is made
   */
  reconnect: (attempt: number) => void;

  /**
   * Emitted when reconnection succeeds
   */
  'reconnect:success': () => void;

  /**
   * Emitted when reconnection fails after all attempts
   */
  'reconnect:failed': (error: Error) => void;

  /**
   * Emitted when memory usage exceeds 90%
   */
  'memory:high': (usagePercent: number) => void;

  /**
   * Emitted when garbage collection is executed
   */
  'gc:executed': () => void;
}
