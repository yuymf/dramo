import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import app from './app';
import { config } from './config';
import { logger } from './lib/logger';
import { initPrisma } from './lib/db';
import { attachCollabWs } from './lib/collab-ws';

const port = config.port;

/**
 * Server timeout configuration for long-running background tasks.
 * The storyboard pipeline runs fire-and-forget (up to ~9 min),
 * so the HTTP server must not close connections prematurely.
 */
const SERVER_HEADERS_TIMEOUT_MS = 600_000;     // 10 min
const SERVER_REQUEST_TIMEOUT_MS = 720_000;     // 12 min
const SERVER_KEEP_ALIVE_TIMEOUT_MS = 620_000;  // 10 min 20s (must be > headersTimeout)

logger.info({ port, nodeEnv: config.nodeEnv }, 'Starting dev server...');

const server = serve({
  fetch: app.fetch,
  port,
}, (info) => {
  logger.info(
    {
      port: info.port,
      nodeEnv: config.nodeEnv,
      url: `http://localhost:${info.port}`,
    },
    'Server started successfully'
  );
});

const httpServer = server as unknown as Server;
attachCollabWs(httpServer);
httpServer.headersTimeout = SERVER_HEADERS_TIMEOUT_MS;
httpServer.requestTimeout = SERVER_REQUEST_TIMEOUT_MS;
httpServer.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;

// Eagerly validate DB connection with retry — surface failures at startup
initPrisma()
  .catch((err) => {
    logger.error({ err }, 'Failed to connect to database after retries — exiting');
    process.exit(1);
  });
