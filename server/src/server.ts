import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import app from './app';
import { config } from './config';
import { logger } from './lib/logger';

const port = config.port;

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

// Increase timeouts for long-running storyboard pipeline (fire-and-forget background tasks)
const httpServer = server as unknown as Server;
httpServer.headersTimeout = 600_000;   // 10 min
httpServer.requestTimeout = 720_000;   // 12 min
httpServer.keepAliveTimeout = 620_000; // 10 min 20s
