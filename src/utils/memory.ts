/**
 * Memory management utilities
 */

/**
 * Get current heap usage as a percentage (0-1)
 */
export function getHeapUsagePercent(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / usage.heapTotal;
}

/**
 * Format bytes to MB string
 */
export function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

/**
 * Get memory usage information
 */
export function getMemoryInfo() {
  const usage = process.memoryUsage();
  return {
    heapUsed: formatMB(usage.heapUsed),
    heapTotal: formatMB(usage.heapTotal),
    heapUsagePercent: (getHeapUsagePercent() * 100).toFixed(2),
  };
}

/**
 * Trigger garbage collection if available
 */
export function triggerGC(): boolean {
  if (global.gc) {
    global.gc();
    return true;
  }
  return false;
}
