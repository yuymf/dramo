import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware, type AuthEnv } from './middleware/auth';
import { errorHandler } from './middleware/error-handler';

// Route modules
import { health } from './routes/health';
import { auth } from './routes/auth';
import { projects } from './routes/projects';
import { scripts } from './routes/scripts';
import { tasks } from './routes/tasks';
import { inspirations } from './routes/inspirations';
import { chat } from './routes/chat';
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
app.use('*', cors({ origin: '*', credentials: true }));
app.use('*', authMiddleware);

// --- Routes ---
app.route('/', health);
app.route('/', auth);
app.route('/', projects);
app.route('/', scripts);
app.route('/', tasks);
app.route('/', inspirations);
app.route('/', chat);
app.route('/', assets);
app.route('/', polish);
app.route('/', characters);
app.route('/', locations);
app.route('/', storyboard);
app.route('/', storyboardPersistence);
app.route('/', aiProviders);
app.route('/', relations);
app.route('/', uploads);
app.route('/', generationJobs);
app.route('/', billing);
app.route('/', llmConfigs);

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
