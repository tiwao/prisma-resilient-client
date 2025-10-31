/**
 * Utility functions for error detection and handling
 */

/**
 * Known Prisma connection error codes
 */
const CONNECTION_ERROR_CODES = [
  'P1001', // Can't reach database server
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a new connection
];

/**
 * Check if an error is a connection-related error
 */
export function isConnectionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as any;

  // Check for Prisma error codes
  if (err.code && CONNECTION_ERROR_CODES.includes(err.code)) {
    return true;
  }

  // Check error message for connection-related keywords
  const message = err.message?.toLowerCase() || '';
  const connectionKeywords = [
    'connection',
    'connect',
    'disconnect',
    'econnrefused',
    'etimedout',
    'enotfound',
    'socket',
    'network',
  ];

  return connectionKeywords.some((keyword) => message.includes(keyword));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  // Currently, all connection errors are considered retryable
  return isConnectionError(error);
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (!error) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }

  return String(error);
}
