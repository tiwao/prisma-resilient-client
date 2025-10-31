/**
 * Utility functions for backoff calculations
 */

export type BackoffStrategy = 'linear' | 'exponential';

/**
 * Calculate delay for retry attempt based on backoff strategy
 */
export function calculateBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  strategy: BackoffStrategy
): number {
  let delay: number;

  if (strategy === 'exponential') {
    // Exponential: initialDelay * 2^(attempt-1)
    delay = initialDelay * Math.pow(2, attempt - 1);
  } else {
    // Linear: initialDelay * attempt
    delay = initialDelay * attempt;
  }

  // Cap at maxDelay
  return Math.min(delay, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
