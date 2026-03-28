import { serve } from '@hono/node-server';
import app from './app';
import { config } from './config';
import { logger } from './lib/logger';

const port = config.port;

logger.info({ port, nodeEnv: config.nodeEnv }, 'Starting dev server...');

serve({
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
