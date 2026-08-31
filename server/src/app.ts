import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sessionMiddleware, type AuthEnv } from './middleware/session';
import { errorHandler } from './middleware/error-handler';
import { config } from './config';

// Route modules
import { health } from './routes/health';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { screenplay } from './routes/screenplay';
import { entities } from './routes/entities';
import { planning } from './routes/planning';
import { assist } from './routes/assist';
import { preproduction } from './routes/preproduction';
import { cinema } from './routes/cinema';
import { files } from './routes/files';
import { collab } from './routes/collab';
import { chat } from './routes/chat';
import { chatSessions } from './routes/chat-sessions';
import { uploads } from './routes/uploads';
import { generationJobs } from './routes/generation-jobs';
import { llmConfigs } from './routes/llm-config';

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
app.route('/api/v1', chat);
app.route('/api/v1', chatSessions);
app.route('/api/v1', uploads);
app.route('/api/v1', generationJobs);
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
