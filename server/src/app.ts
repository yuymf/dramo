import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sessionMiddleware, type AuthEnv } from './middleware/session.js';
import { errorHandler } from './middleware/error-handler.js';
import { config } from './config/index.js';

// Route modules
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
import { projects } from './routes/projects.js';
import { screenplay } from './routes/screenplay.js';
import { entities } from './routes/entities.js';
import { planning } from './routes/planning.js';
import { assist } from './routes/assist.js';
import { preproduction } from './routes/preproduction.js';
import { cinema } from './routes/cinema.js';
import { files } from './routes/files.js';
import { collab } from './routes/collab.js';
import { uploads } from './routes/uploads.js';
import { generationTasks } from './routes/generation-tasks.js';
import { llmConfigs } from './routes/llm-config.js';

const app = new Hono<AuthEnv>();

// --- Global middleware ---
app.use('*', cors({
  origin: (origin) => origin || config.frontendUrl,
  credentials: true,
  allowHeaders: ['Content-Type', 'X-Request-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use('*', sessionMiddleware);

// --- Routes (all mounted under /api/v1) ---
app.route('/api/v1', health);
app.route('/api/v1', auth);
app.route('/api/v1', projects);
app.route('/api/v1', screenplay);
app.route('/api/v1', entities);
app.route('/api/v1', planning);
app.route('/api/v1', assist);
app.route('/api/v1', preproduction);
app.route('/api/v1', cinema);
app.route('/api/v1', files);
app.route('/api/v1', collab);
app.route('/api/v1', uploads);
app.route('/api/v1', generationTasks);
app.route('/api/v1', llmConfigs);

// --- Error handler ---
app.onError(errorHandler);

// --- 404 handler ---
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        retryable: false,
      },
    },
    404
  );
});

export default app;
export { app };
