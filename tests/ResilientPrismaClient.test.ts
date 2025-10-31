/**
 * Unit tests for ResilientPrismaClient
 */

import { ResilientPrismaClient } from '../src';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => {
      return {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([{ result: 1 }]),
      };
    }),
  };
});

describe('ResilientPrismaClient', () => {
  let client: any;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = new PrismaClient();
  });

  afterEach(async () => {
    if (client) {
      await client.shutdown();
    }
  });

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      client = new ResilientPrismaClient(mockPrisma);
      expect(client).toBeInstanceOf(ResilientPrismaClient);
    });

    it('should create instance with custom config', () => {
      client = new ResilientPrismaClient(mockPrisma, {
        reconnect: {
          maxAttempts: 5,
          initialDelay: 500,
        },
      });
      expect(client).toBeInstanceOf(ResilientPrismaClient);
    });
  });

  describe('Connection state', () => {
    it('should report connection status', async () => {
      client = new ResilientPrismaClient(mockPrisma);

      // Wait a bit for connection to establish
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(typeof client.isConnected()).toBe('boolean');
    });

    it('should return connection stats', async () => {
      client = new ResilientPrismaClient(mockPrisma);

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = client.getConnectionStats();
      expect(stats).toHaveProperty('isConnected');
      expect(stats).toHaveProperty('reconnectAttempts');
      expect(stats).toHaveProperty('totalReconnects');
      expect(stats).toHaveProperty('queryCount');
      expect(stats).toHaveProperty('errorCount');
    });
  });

  describe('Health check', () => {
    it('should perform health check', async () => {
      client = new ResilientPrismaClient(mockPrisma);

      await new Promise(resolve => setTimeout(resolve, 100));

      const health = await client.healthCheck();
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('database');
      expect(['healthy', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Event system', () => {
    it('should emit connect event', (done) => {
      client = new ResilientPrismaClient(mockPrisma);

      client.on('connect', () => {
        done();
      });
    });

    it('should support event listeners', () => {
      client = new ResilientPrismaClient(mockPrisma);

      const connectListener = jest.fn();
      const disconnectListener = jest.fn();

      client.on('connect', connectListener);
      client.on('disconnect', disconnectListener);

      expect(client.listenerCount('connect')).toBe(1);
      expect(client.listenerCount('disconnect')).toBe(1);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      client = new ResilientPrismaClient(mockPrisma);

      await new Promise(resolve => setTimeout(resolve, 100));

      await expect(client.shutdown()).resolves.not.toThrow();
    });
  });
});
