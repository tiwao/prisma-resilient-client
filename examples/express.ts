/**
 * Express integration example
 */

import express from 'express';
import { ResilientPrismaClient } from '../src';

const app = express();
const prisma = new ResilientPrismaClient({
  resilient: {
    reconnect: {
      maxAttempts: 3,
    },
    healthCheck: {
      enabled: true,
      intervalMs: 60 * 1000, // 1 minute
    },
  },
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await prisma.healthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Connection stats endpoint
app.get('/stats', (req, res) => {
  const stats = prisma.getConnectionStats();
  res.json(stats);
});

// Example API endpoint
app.get('/api/data', async (req, res) => {
  try {
    // Your Prisma queries here
    // const users = await prisma.user.findMany();
    res.json({ message: 'Success' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.shutdown();
  process.exit(0);
});
