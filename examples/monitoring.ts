/**
 * Monitoring integration example (Slack, Sentry, etc.)
 */

import { ResilientPrismaClient } from '../src';

async function sendToSlack(message: string) {
  // Replace with your Slack webhook URL
  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  if (!SLACK_WEBHOOK_URL) return;

  await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });
}

const prisma = new ResilientPrismaClient({
  resilient: {
    reconnect: {
      maxAttempts: 5,
      initialDelay: 1000,
    },
    logging: {
      level: 'info',
    },
    onError: async (error, context) => {
      console.error('Database error:', {
        error: error.message,
        operation: context.operation,
        retryCount: context.retryCount,
        duration: context.duration,
      });

      // Send to Slack
      await sendToSlack(
        `🚨 Database Error\n` +
        `Operation: ${context.operation}\n` +
        `Error: ${error.message}\n` +
        `Retries: ${context.retryCount}\n` +
        `Duration: ${context.duration}ms`
      );

      // Send to Sentry (if you have it configured)
      // Sentry.captureException(error, { contexts: { prisma: context } });
    },
  },
});

// Monitor high memory usage
prisma.on('memory:high', (usagePercent) => {
  console.warn(`⚠️  High memory usage: ${usagePercent.toFixed(2)}%`);
  sendToSlack(`⚠️  High memory usage detected: ${usagePercent.toFixed(2)}%`);
});

// Monitor reconnection failures
prisma.on('reconnect:failed', (error) => {
  console.error('❌ Reconnection failed:', error.message);
  sendToSlack(`❌ Database reconnection failed: ${error.message}`);
});

// Monitor successful reconnections
prisma.on('reconnect:success', () => {
  console.log('✅ Database reconnected successfully');
  sendToSlack('✅ Database reconnected successfully');
});

// Example usage
async function main() {
  // Your application logic here
  console.log('Application running with monitoring...');

  // Periodic stats logging
  setInterval(() => {
    const stats = prisma.getConnectionStats();
    console.log('Database stats:', {
      connected: stats.isConnected,
      totalReconnects: stats.totalReconnects,
      queryCount: stats.queryCount,
      errorCount: stats.errorCount,
      uptimeMinutes: Math.floor(stats.uptime / 1000 / 60),
    });
  }, 5 * 60 * 1000); // Every 5 minutes
}

main().catch(console.error);
