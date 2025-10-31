# Prisma Resilient Client

**Production-ready Prisma Client with automatic reconnection and robust connection management.**

## Why This Package?

Prisma is an excellent ORM, but it lacks critical features for production environments:

- ❌ No automatic reconnection on connection loss
- ❌ No connection state management
- ❌ No built-in health checks
- ❌ Requires manual implementation of retry logic

This package solves all these problems with a drop-in replacement for `PrismaClient`.

## Features

- ✅ **Automatic Reconnection** - Handles connection drops gracefully
- ✅ **Connection State Management** - Know when you're connected
- ✅ **Health Checks** - Built-in endpoint support
- ✅ **Memory Management** - Automatic GC triggering
- ✅ **Event System** - Hook into connection lifecycle
- ✅ **Custom Error Handling** - Integrate with your monitoring
- ✅ **Zero Breaking Changes** - Drop-in replacement

## Installation

```bash
npm install prisma-resilient-client
# or
yarn add prisma-resilient-client
# or
pnpm add prisma-resilient-client
```

## Quick Start

```typescript
import { PrismaClient } from '@prisma/client';
import { ResilientPrismaClient } from 'prisma-resilient-client';

// Create your PrismaClient as usual
const basePrisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Wrap it with ResilientPrismaClient
const resilientClient = new ResilientPrismaClient(basePrisma, {
  reconnect: {
    maxAttempts: 3,
    initialDelay: 1000,
  },
  refresh: {
    enabled: true,
    intervalMs: 5 * 60 * 1000, // 5 minutes
  },
});

// Get the wrapped Prisma client
const prisma = resilientClient.getClient();

// Use it exactly like PrismaClient - automatic reconnection on failures!
const user = await prisma.user.create({
  data: { name: 'John', email: 'john@example.com' }
});
```

## Configuration

### Full Configuration Options

```typescript
const basePrisma = new PrismaClient({ /* your Prisma config */ });

const resilientClient = new ResilientPrismaClient(basePrisma, {
    // Reconnection settings
    reconnect: {
      maxAttempts: 3,              // Maximum retry attempts
      initialDelay: 1000,          // Initial delay in ms
      maxDelay: 10000,             // Maximum delay in ms
      backoff: 'exponential',      // 'linear' or 'exponential'
    },

    // Periodic refresh
    refresh: {
      enabled: true,
      intervalMs: 5 * 60 * 1000,   // 5 minutes
    },

    // Memory management
    memory: {
      autoGC: true,                // Enable automatic GC
      gcThreshold: 0.85,           // Trigger at 85% heap usage
    },

    // Health checks
    healthCheck: {
      enabled: true,
      intervalMs: 60 * 1000,       // 1 minute
    },

    // Logging
    logging: {
      level: 'info',               // 'debug' | 'info' | 'warn' | 'error'
      logger: console,             // Custom logger
    },

    // Error handler
    onError: async (error, context) => {
      console.error('Database error:', error);
      // Send to Slack, Sentry, etc.
    },
});

// Get the wrapped client
const prisma = resilientClient.getClient();
```

## API Reference

### Connection Status

```typescript
// Check if connected
if (resilientClient.isConnected()) {
  console.log('Connected to database');
}

// Get connection statistics
const stats = resilientClient.getConnectionStats();
console.log(stats);
// {
//   isConnected: true,
//   reconnectAttempts: 0,
//   totalReconnects: 2,
//   lastSuccessfulConnection: '2025-10-31T02:03:45.000Z',
//   uptime: 3600000,
//   queryCount: 1250,
//   errorCount: 0
// }
```

### Health Check

```typescript
const health = await resilientClient.healthCheck();
console.log(health);
// {
//   status: 'healthy',
//   database: 'connected',
//   latency: 2,
//   memory: { heapUsed: '150.50', heapTotal: '200.00', heapUsagePercent: '75.25' }
// }
```

### Event Listeners

```typescript
// Connection events
resilientClient.on('connect', () => {
  console.log('Database connected');
});

resilientClient.on('disconnect', (error) => {
  console.error('Database disconnected', error);
});

resilientClient.on('reconnect', (attempt) => {
  console.log(`Reconnecting... (attempt ${attempt})`);
});

resilientClient.on('reconnect:success', () => {
  console.log('Reconnection successful');
});

resilientClient.on('reconnect:failed', (error) => {
  console.error('Reconnection failed', error);
});

// Memory events
resilientClient.on('memory:high', (usage) => {
  console.warn(`High memory usage: ${usage}%`);
});

resilientClient.on('gc:executed', () => {
  console.log('Garbage collection executed');
});
```

## Examples

### Express Health Endpoint

```typescript
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { ResilientPrismaClient } from 'prisma-resilient-client';

const app = express();
const basePrisma = new PrismaClient();
const resilientClient = new ResilientPrismaClient(basePrisma);
const prisma = resilientClient.getClient();

app.get('/health', async (req, res) => {
  const health = await resilientClient.healthCheck();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.get('/users', async (req, res) => {
  const users = await prisma.user.findMany(); // Auto-reconnects on failure!
  res.json(users);
});

app.listen(3000);
```

### Slack Notifications

```typescript
import { PrismaClient } from '@prisma/client';
import { ResilientPrismaClient } from 'prisma-resilient-client';

const basePrisma = new PrismaClient();
const resilientClient = new ResilientPrismaClient(basePrisma, {
  onError: async (error, context) => {
    await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
      method: 'POST',
      body: JSON.stringify({
        text: `🚨 Database Error: ${error.message}`,
        fields: [
          { title: 'Operation', value: context.operation },
          { title: 'Retry', value: context.retryCount },
        ],
      }),
    });
  },
});

const prisma = resilientClient.getClient();
```

### Long-Running Server

```typescript
const basePrisma = new PrismaClient();
const resilientClient = new ResilientPrismaClient(basePrisma, {
  refresh: {
    enabled: true,
    intervalMs: 5 * 60 * 1000, // Refresh every 5 minutes
  },
  memory: {
    autoGC: true,
    gcThreshold: 0.85, // GC at 85% heap usage
  },
});

const prisma = resilientClient.getClient();

// Server will automatically maintain connection health
// All queries use prisma, which has auto-reconnection built in!
```

## How It Works

### Automatic Reconnection Flow

```
1. Query fails with connection error
   ↓
2. Detect connection error (P1001, P1008, etc.)
   ↓
3. Attempt reconnection (max 3 times)
   ↓
4. Wait with backoff strategy
   ↓
5. Retry original operation
   ↓
6. Success or throw after max attempts
```

### Connection Refresh

```
Every 5 minutes:
  ↓
Disconnect
  ↓
Reconnect
  ↓
Update connection state
```

## Comparison with Other Solutions

| Feature | Prisma | prisma-extension-retry | **prisma-resilient-client** |
|---------|--------|------------------------|----------------------------|
| Auto Reconnect | ❌ | ✅ | ✅ |
| Connection State | ❌ | ❌ | ✅ |
| Health Check | ❌ | ❌ | ✅ |
| Memory Management | ❌ | ❌ | ✅ |
| Event System | ❌ | ❌ | ✅ |
| Production Ready | ⚠️ | ⚠️ | ✅ |

## Requirements

- Node.js >= 16.0.0
- @prisma/client >= 5.0.0

## License

MIT

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Support

- 🐛 [Report a bug](https://github.com/saito/prisma-resilient-client/issues)
- 💡 [Request a feature](https://github.com/saito/prisma-resilient-client/issues)
- 📖 [Documentation](https://github.com/saito/prisma-resilient-client#readme)

## Acknowledgments

Built with lessons learned from production deployments handling millions of database operations.

### Production Validation

This package has been battle-tested in production with:
- ✅ 11+ million database records processed
- ✅ Long-running servers (days of uptime)
- ✅ Automatic recovery from "Engine is not yet connected" errors
- ✅ Zero manual intervention required

**Real-world deployment**: [video_analyzer_web](https://st-data.iop-plus.kochi.jp) - Video analysis system with audio FFT and MediaPipe face mesh detection.

---

**Made with ❤️ for the Prisma community**

**Status**: ✅ Production-ready (v0.1.1) - Successfully deployed and tested

## Change Log

### v0.1.1 (2025-10-31)
**Bug Fixes:**
- 定期リフレッシュの堅牢性向上
  - disconnect失敗時も`connected`フラグを確実にfalseに設定
  - リフレッシュ処理で`ensureConnected()`を使用して再接続のリトライロジックを活用
  - リフレッシュ失敗時も`connected`フラグをfalseに設定し、次回操作時の再接続を保証

### v0.1.0 (2025-10-31)
**Initial Release:**
- 自動再接続機能の実装
- 定期的な接続リフレッシュ機能
- ヘルスチェック機能
- メモリ管理機能
- イベントシステム
