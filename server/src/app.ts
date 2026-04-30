import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, type AuthEnv } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';
import { config } from './config';

// Route modules
import { health } from './routes/health';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { scripts } from './routes/scripts';
import { tasks } from './routes/tasks';
import { inspirations } from './routes/inspirations';
import { chat } from './routes/chat';
import { chatSessions } from './routes/chat-sessions';
import { assets } from './routes/assets';
import { polish } from './routes/polish';
import { characters } from './routes/characters';
import { locations } from './routes/locations';
import { storyboard } from './routes/storyboard';
import { storyboardPersistence } from './routes/storyboard-persistence';
import { aiProviders } from './routes/ai-providers';
import { relations } from './routes/relations';
import { uploads } from './routes/uploads';
import { generationJobs } from './routes/generation-jobs';
import { billing } from './routes/billing';
import { llmConfigs } from './routes/llm-config';

const app = new Hono<AuthEnv>();

// --- Global middleware ---
app.use('*', cors({
  origin: config.corsAllowedOrigins,
  credentials: true,
}));

// --- Legacy /api/* → /api/v1/* redirect (301 permanent) ---
// Must run BEFORE auth middleware so unauthenticated redirects work
app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (!path.startsWith('/api/v1')) {
    const newPath = path.replace(/^\/api\//, '/api/v1/');
    const newUrl = new URL(c.req.url);
    newUrl.pathname = newPath;
    return c.redirect(newUrl.toString(), 301);
  }
  return next();
});

app.use('*', authMiddleware);

// --- Routes (all mounted under /api/v1) ---
app.route('/api/v1', health);
app.route('/api/v1', auth);
app.route('/api/v1', projects);
app.route('/api/v1', scripts);
app.route('/api/v1', tasks);
app.route('/api/v1', inspirations);
app.route('/api/v1', chat);
app.route('/api/v1', chatSessions);
app.route('/api/v1', assets);
app.route('/api/v1', polish);
app.route('/api/v1', characters);
app.route('/api/v1', locations);
app.route('/api/v1', storyboard);
app.route('/api/v1', storyboardPersistence);
app.route('/api/v1', aiProviders);
app.route('/api/v1', relations);
app.route('/api/v1', uploads);
app.route('/api/v1', generationJobs);
app.route('/api/v1', billing);
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
