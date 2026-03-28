# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Story Agent Backend — an AI-powered story script generation service. Two runtimes cooperate:

1. **TypeScript API** (Hono, port 12321): REST API, authentication, SSE streaming, database access. Deployable to **Vercel Serverless** or standalone via `@hono/node-server`.
2. **Python AgentOS** (FastAPI + Agno framework, port 12322): Multi-agent AI workflows for storyboard generation, character extraction, location extraction, script polishing, and image generation. Independently deployed.

The TS API delegates AI work to AgentOS over HTTP. Long-running operations use SSE streaming with a 55s timeout + auto-reconnect protocol (compatible with Vercel Hobby 60s limit).

## Common Commands

```bash
# Install & generate
npm install
npm run prisma:generate        # Generate Prisma client (required after schema changes)
npm run prisma:migrate         # Run database migrations

# Development
npm run dev                    # Hono API with hot reload (tsx watch)

# Build & production
npm run build                  # tsc → dist/
npm start                      # node dist/server.js (standalone)

# Vercel
vercel dev                     # Local Vercel dev server
vercel deploy                  # Deploy to Vercel

# Linting
npm run lint                   # ESLint on src/**/*.ts

# Tests
npm test                       # Jest (TS layer)
cd agentos && python -m pytest tests/  # Python tests

# Database
npm run prisma:studio          # Visual DB browser

# Docker (local dev with AgentOS)
docker compose up -d           # API + AgentOS
docker compose --profile localpg up -d   # Include local PostgreSQL
```

## Architecture

```
Client → Hono API (TS, Vercel Serverless) ─┬─ Prisma → Supabase PostgreSQL
                                            ├─ Supabase Storage (images)
                                            ├─ SSE streaming (55s chunks + reconnect)
                                            └─ HTTP → AgentOS (Python/Agno)
                                                       ├─ StoryboardWorkflow
                                                       ├─ CharactersWorkflow
                                                       ├─ LocationsWorkflow
                                                       ├─ PolishWorkflow
                                                       └─ ImageService (Seedream/Doubao ARK)
```

### TypeScript layer (`src/`)

- **`app.ts`** — Hono app setup: CORS, auth middleware, route registration, error handler.
- **`server.ts`** — Standalone `@hono/node-server` entry for local dev.
- **`api/[[...route]].ts`** — Vercel serverless entry point (catch-all handler).
- **`config/index.ts`** — Centralized env-based configuration object.
- **`routes/`** — Hono route handlers. Each file exports a `Hono<AuthEnv>` instance.
- **`middleware/`** — `auth.ts` (JWT + requestId), `error-handler.ts` (unified error envelope).
- **`services/`** — Business logic layer. One service per domain (project, script, storyboard, asset, chat, generation-job, etc.)
- **`lib/`** — Shared infrastructure:
  - `db.ts` — Prisma client (serverless singleton pattern)
  - `agentos-client.ts` — HTTP/SSE client to AgentOS (native `fetch`, no `node-fetch`)
  - `sse.ts` — SSE helper: `streamSSEResponse()`, `parseAgentOSSSE()`, heartbeat, 55s timeout
  - `errors.ts` — Unified `AppError` type + `ErrorCode` enum
  - `logger.ts` — pino logger
- **`db/schema.prisma`** — Prisma schema. Migrations in `db/migrations/`.

### Python layer (`agentos/`)

- **`app.py`** — Unified AgentOS runtime. Registers workflows with `AgentOS` from the `agno` framework, adds custom FastAPI routes for image generation and AI provider management.
- **`config.py`** — AI provider configuration (OpenAI or Hunyuan). Reads from `.env`.
- **`workflows/`** — Agno `Workflow` subclasses with `Step`-based execution.
- **`services/image_service.py`** — Seedream (Doubao ARK) image generation.
- **`prompts/`** — Markdown system/user prompt templates.
- **`tests/`** — Python tests (pytest).

### Inter-service communication

The TS API calls AgentOS via `lib/agentos-client.ts`:
- `startWorkflowRun()` — POST to `/workflows/{id}/runs`. Returns raw `Response` for JSON or SSE consumption.
- `postAgentOS<T>()` — Generic JSON POST to custom AgentOS endpoints.
- `getAgentOS<T>()` — Generic JSON GET.
- `runImageGeneration()` — POST to `/api/generate-image`.
- SSE streaming is fully supported for long-running workflows via `parseAgentOSSSE()`.

## Key Patterns

- **Error envelope**: All API errors use `{ error: { code, message, retryable }, requestId }` format. Use `createError()` from `lib/errors.ts`.
- **Auth**: JWT Bearer token. Public paths defined in `middleware/auth.ts`. `c.get('user').userId` available on authenticated routes.
- **SSE streaming**: Long operations (chat, storyboard import, characters, locations, polish) support `?stream=true` or `body.stream=true`. Uses 55s timeout with auto-reconnect protocol. Heartbeat every 15s.
- **Image generation**: Fire-and-forget inline execution via `generation-job.service.ts`. Client polls via SSE stream (`/api/jobs/stream`) or individual job status.
- **AI providers**: Configurable via `AI_PROVIDER` env var — `openai` (default) or `hunyuan`. The AgentOS Python layer uses `OpenAIChat` from Agno for both.
- **Storage**: Configurable via `STORAGE_DRIVER` — `local` (dev) or `supabase` (prod). Managed by `services/storage.service.ts`.
- **Serverless Prisma**: Uses global singleton pattern (`globalForPrisma`) to reuse PrismaClient across warm Vercel invocations.

## Environment

- Required: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`
- Copy `env.example` to `.env` for local development
- AgentOS reads `.env` from the project root via `agentos/env_loader.py`
- Docker networking: API reaches AgentOS at `http://agentos:12322`, local dev uses `http://localhost:12322`

## Ports

| Service  | Port  |
|----------|-------|
| API      | 12321 |
| AgentOS  | 12322 |
| Postgres | 5432 (localpg profile) |

## TypeScript Configuration

- Target: ES2022, ES modules (`"type": "module"`)
- Module resolution: bundler
- Strict mode enabled with `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- JSX: react-jsx with Hono import source
- Node.js 20+ required

## Deployment

- **Vercel**: TS API deploys as serverless functions via `api/[[...route]].ts`. Configure `vercel.json` for rewrites. Hobby plan: 60s max function duration.
- **AgentOS**: Independently deployed (Docker, cloud VM, or any Python hosting). Set `AGENTOS_BASE_URL` env var in Vercel to point to the AgentOS instance.
