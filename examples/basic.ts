/**
 * Basic usage example
 */

import { ResilientPrismaClient } from '../src';

async function main() {
  // Create client with default configuration
  const prisma = new ResilientPrismaClient({
    resilient: {
      reconnect: {
        maxAttempts: 3,
        initialDelay: 1000,
      },
      logging: {
        level: 'info',
      },
    },
  });

  // Listen to connection events
  prisma.on('connect', () => {
    console.log('✅ Connected to database');
  });

  prisma.on('disconnect', (error) => {
    console.error('❌ Disconnected:', error?.message);
  });

  prisma.on('reconnect', (attempt) => {
    console.log(`🔄 Reconnecting... (attempt ${attempt})`);
  });

  prisma.on('reconnect:success', () => {
    console.log('✅ Reconnection successful');
  });

  // Check connection status
  console.log('Connected:', prisma.isConnected());

  // Get connection stats
  const stats = prisma.getConnectionStats();
  console.log('Connection stats:', stats);

  // Perform health check
  const health = await prisma.healthCheck();
  console.log('Health check:', health);

  // Clean shutdown
  await prisma.shutdown();
}

main().catch(console.error);
