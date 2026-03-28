# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dramo.ai** — an AI-powered livestream script creation tool (AI 直播台本生成助手). The frontend is a Next.js 15 App Router application (React 19, TypeScript, Tailwind CSS v4) that proxies all API calls to a separate backend (Fastify on port 12321) and an AgentOS service (FastAPI on port 12322).

## Commands

```bash
npm run dev          # Dev server with Turbopack on port 12323
npm run build        # Production build (Turbopack)
npm start            # Production server on port 12323
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
npm run openapi:build  # Convert specs/001-ai-ai-ai/contracts/openapi.yaml → public/openapi.json
```

No test runner is configured in package.json. MSW (`msw` + `@faker-js/faker`) is set up for mock data in `mock/`.

## Environment Variables

Copy `env.local.example` → `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXTAUTH_SECRET` | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | NextAuth callback URL (`http://localhost:12323`) |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (`http://localhost:12321`) |
| `BACKEND_API_URL` | Server-side override for backend URL (takes precedence over `NEXT_PUBLIC_API_URL`) |

## Architecture

### Port Allocation
- **12323** — Frontend (Next.js)
- **12321** — Backend API (Fastify)
- **12322** — AgentOS (FastAPI)

### API Proxy Pattern
All client-side API calls go through Next.js API Routes (`app/api/`) which proxy to the backend. The central proxy utility is `app/api/_utils/proxy.ts` (`proxyRequest`). It handles:
- Auth injection via `next-auth` session (Bearer token from `session.backendToken`)
- Body format detection (JSON, FormData, URL-encoded)
- Unified error envelope (`{ error: { code, message, retryable } }`)

Client-side code uses `lib/api/client.ts` (`api<T>()`) — a typed fetch wrapper that always calls relative `/api/` paths with cookie-based auth (`credentials: 'include'`). Supports optional client-side GET caching and request timeouts.

### Authentication
NextAuth v4 with Credentials provider. Login calls `POST /api/auth/login` on the backend, stores the returned token in the JWT. The `backendToken` is augmented onto the Session type (see `next-auth.d.ts`). Custom login page at `/login`.

### Routing (Parallel Routes)
The project page at `app/projects/[id]/` uses Next.js parallel routes:
- `@sidebar` — persistent project navigation sidebar
- `@content` — deep-linked content area with independent URLs

Key content routes under `@content`:
- `/scripts` — Script editor (linear mode, default)
- `/scripts/dialogue` — Branching editor (WIP)
- `/scripts/hollywood` — Storyboard editor (WIP)
- `/input` — Generation input form
- `/characters` — Character management + relation graph
- `/locations` — Location management
- `/storyboard` — Storyboard frames with shot-level detail

Legacy route `/scripts/:id` redirects to `/projects/:id/scripts` via `next.config.ts`.

### Domain Model
Core types are in `lib/models.ts`:
- **Script** — has Acts → Scenes → Blocks (HTML content). Three forms: `linear`, `branching`, `storyboard`
- **Character** — with speech features, style tags, image assets, and relation graphs (`@xyflow/react`)
- **Storyboard** — scenes containing Shots with camera, dialogue, and generation prompts
- **GenerationJob** — async task tracking for AI operations (`lib/types/generation-job.ts`)

### State & Data Flow
- `next-auth/react` `SessionProvider` wraps the app (`app/providers.tsx`)
- `AIChatProvider` (`app/ai-chat-provider.tsx`) — manages AI chat drawer state, current page type detection, JSON data for AI context, and pending AI-suggested changes
- `GenerationJobsProvider` — tracks async image/script generation job polling
- No global state library (Zustand listed as "on-demand" but not currently installed)

### UI Stack
- **Tailwind CSS v4** with `@tailwindcss/postcss`
- **Radix UI** primitives (dropdown-menu, scroll-area, separator, tabs)
- **shadcn/ui** components in `components/ui/`
- **TipTap** rich text editor for script content
- **@dnd-kit** for drag-and-drop (sortable scenes/blocks)
- **Lucide React** + **React Icons** for iconography
- **docx** + **jspdf** for script export (`lib/utils/exporter.ts`)

### Design Guidelines (from Cursor rules)
Product name: DRAMO. Muji-inspired visual style:
- Background: cream/off-white/oatmeal tones (not pure black/white)
- Typography: Songti SC / Georgia for content; system sans-serif for UI
- Generous whitespace, line-style icons, subtle paper textures
- The AI companion is portrayed as a focused, cute cat character

### Key Directories
- `app/api/` — Next.js API route handlers (proxy to backend)
- `app/projects/[id]/` — Main project workspace with parallel routes
- `components/` — Feature-grouped React components (editor, chat, storyboard, characters, etc.)
- `lib/api/` — Client-side API functions and typed wrappers
- `lib/hooks/` — Custom hooks (autosave, generation jobs, SSE, keyboard shortcuts)
- `lib/models.ts` — Core TypeScript domain types
- `lib/utils/` — Export utilities, JSON processing, format validation
- `docs/` — Backend API specs, architecture docs, integration guides
