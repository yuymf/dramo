<div align="center">
  <img src="docs/assets/logo.png" alt="Dramo" width="72" height="72">

# Dramo

**AI screenplay workspace — outline to storyboard, one place.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker&logoColor=white)](./docker-compose.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](./web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

[English](#) · [中文](README.zh.md) · [Architecture](docs/architecture.md) · [Env & deploy](docs/env-and-deploy.md) · [API](docs/api-reference.md)
</div>

<p align="center">
  <img src="docs/assets/cover.jpg" alt="Dramo — AI screenplay workspace" width="100%">
</p>

Dramo is a full-stack monorepo for writing screenplays with scoped AI revise: Next.js workspace + Hono API + AgentOS (Agno) + PostgreSQL. Auth is cookie session (`dramo_session`) — register / login required. There is no `default-local-user`.

```
Nginx (:80)  →  Web (:12323 / :3000)  +  /api/* → Server (:12321)  →  AgentOS (:12322)
                     ↓
                PostgreSQL
```

## Features

- 🎬 **Screenplay workspace** — scenes, dialogue, outline, beats in one document truth
- ✨ **Scoped AI revise** — selection / scene / entity / outline preview with accept / reject
- 🧍 **Derived entities** — characters, locations, props from the script, not a parallel dump
- 🖼️ **Storyboard + SD pool** — A1111-compatible worker pool (`SD_WORKERS`) for stills
- 🐳 **One-command Docker** — Compose brings up web, API, AgentOS, Postgres, Nginx

## Quick start (Docker) — recommended

Full stack for strangers:

```bash
git clone https://github.com/yuymf/dramo.git
cd dramo
./deploy/setup-dramo.sh    # generates .env secrets + docker compose up -d --build
# open http://localhost
```

Or manually:

```bash
cp .env.example .env
# set ENCRYPTION_KEY=$(openssl rand -hex 32)  # required in production
docker compose up -d --build
```

Ops helpers: `./deploy/logs.sh [service] [-f]` · `./deploy/update.sh`

> **Honest deploy note:** the product needs Postgres + Hono + AgentOS. Docker Compose is the supported one-command path for the **full** stack. The Next.js `web/` app alone can sit on Vercel (Deploy button below) if `BACKEND_API_URL` points at a reachable API — that is **not** a full-stack one-click.

[![Deploy web with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyuymf%2Fdramo&root-directory=web&env=BACKEND_API_URL,NEXT_PUBLIC_API_URL&envDescription=BACKEND_API_URL%20must%20point%20at%20your%20deployed%20Hono%20API%20(full%20stack%20still%20needs%20Docker).&envLink=https%3A%2F%2Fgithub.com%2Fyuymf%2Fdramo%2Fblob%2Fmain%2Fdocs%2Fenv-and-deploy.md&project-name=dramo-web&repository-name=dramo)

## Environment

Root `.env` for Compose (see [`.env.example`](.env.example)):

| Variable | Required | Purpose |
|:---|:---:|:---|
| `ENCRYPTION_KEY` | **yes** (prod) | 64 hex chars; AES-256-GCM for `UserLLMConfig` |
| `DB_PASSWORD` | yes | Postgres password (`dramo` user) |
| `AGENTOS_KEY` | yes | Shared `AGENTOS_SECURITY_KEY` for api ↔ agentos |
| `PUBLIC_URL` | yes | Public origin (cookies / file URLs) |
| `PORT` | no | Host Nginx port (default `80`) |
| `SD_WORKERS` | for stills | JSON worker pool; **not** `127.0.0.1` inside Docker |
| `LLM_TIMEOUT_SECONDS` / `LLM_MAX_RETRIES` | no | AgentOS tuning |

LLM API keys are **not** process env — users paste them in **Settings → LLM** (stored encrypted).

Local dev without Compose: `server/env.example` → `server/.env`, `web/env.local.example` → `web/.env.local`. Details: [docs/env-and-deploy.md](docs/env-and-deploy.md).

## Local development (no full Docker)

```bash
npm install
cd agentos && pip install -r requirements.txt && cd ..

docker run -d --name dramo-pg \
  -e POSTGRES_DB=dramo -e POSTGRES_USER=dramo -e POSTGRES_PASSWORD=dramo_secret \
  -p 5432:5432 postgres:15-alpine

cp server/env.example server/.env   # set ENCRYPTION_KEY for anything beyond smoke
npm run prisma:generate
npm run prisma:migrate
npm run dev                         # web :12323 + server :12321 + agentos :12322
```

Browser uses relative `/api/*`; Next.js proxies to `BACKEND_API_URL` (default `http://localhost:12321`).

## Architecture

| Service | Stack | Port |
|:---|:---|:---|
| **web** | Next.js 15 + React 19 + Tailwind v4 | 12323 (dev) / 3000 (container) |
| **server** | Hono v4 + Prisma 5 + PostgreSQL | 12321 |
| **agentos** | Python FastAPI + Agno (revise workflow) | 12322 |
| **nginx** | Reverse proxy | 80 |
| **postgres** | PostgreSQL 15 | 5432 (localhost-bound in Compose) |

Auth: `server/src/middleware/session.ts`. Outside `/auth/*` and `/health`, missing session → 401.

## Common commands

| Command | What it does |
|:---|:---|
| `npm run dev` | web + server + agentos |
| `npm run build` | build server + web |
| `npm run lint` | lint web + server |
| `npm run test` | server Jest |
| `npm run prisma:migrate` | apply migrations |
| `npm run test:e2e -w @dramo/web` | Playwright (stack must be up) |

CI: [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (lint, Jest, AgentOS pytest). E2E: [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) (Compose + Playwright).

## Docs

- [Architecture](docs/architecture.md)
- [API reference](docs/api-reference.md)
- [Database schema](docs/database-schema.md)
- [Environment & deploy](docs/env-and-deploy.md)
- Product planning (zh): [PRD](docs/prd-laper-parity.md), [phase contracts](docs/phase1-contracts.md)

## License

[MIT](./LICENSE) © 2026 Yuymf
