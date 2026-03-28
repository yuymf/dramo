# Story Agent Backend

Standalone backend service for AI-powered story script generation, built with Fastify, Prisma, and Supabase.

## Features

- **Fastify** - High-performance HTTP framework
- **Prisma** - Type-safe ORM for Supabase Postgres
- **BullMQ** - Robust job queue for async tasks
- **Redis** - Caching and queue management
- **AgentOS** - Python AI service with Agno multi-agent framework
- **OpenTelemetry** - Observability and tracing
- **Docker** - One-command deployment

## Architecture

```
Backend Service
├── API Layer (Fastify + TypeScript)
│   ├── Authentication (JWT)
│   ├── Rate Limiting (Redis)
│   ├── Idempotency
│   └── Unified Error Handling
├── Service Layer
│   ├── Projects, Scripts, Inspirations
│   ├── Chat, Assets, Tasks
│   └── Business Logic
├── Worker Pool (BullMQ)
│   ├── Script Generation
│   ├── Scene Regeneration
│   └── Inspiration Refresh
├── AgentOS (Python + Agno)
│   ├── Multi-Agent AI Orchestration
│   ├── Specialized Agents
│   └── OpenAI Integration
└── Data Layer
    ├── Supabase Postgres (via Prisma)
    └── Redis (cache & queues)
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Supabase project (for database)
- OpenAI API key

### 1. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your credentials
# - DATABASE_URL: Your Supabase connection string
# - JWT_SECRET: Secret for JWT tokens
# - OPENAI_API_KEY: OpenAI API key
```

### 2. Start with Docker (Recommended)

```bash
# Start all services (API, Worker, Redis)
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

The API will be available at `http://localhost:12321` with docs at `http://localhost:12321/docs`.

### 3. Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Start development server (hot reload)
npm run dev

# In another terminal, start workers
npm run worker
```

### 4. Using Local PostgreSQL

```bash
# Start with local Postgres instead of Supabase
docker compose --profile localpg up -d

# Update .env DATABASE_URL to local:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/story_agent
```

## API Endpoints

### Core Endpoints

- `GET /api/health` - Health check
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/{id}/script` - Get script
- `POST /api/projects/{id}/script` - Generate script (async)
- `GET /api/tasks/{taskId}` - Query task status

### Full API Documentation

Visit `http://localhost:12321/docs` after starting the server for interactive Swagger documentation.

## Project Structure

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/          # API route handlers
│   │   └── middleware/      # Auth, rate limit, etc.
│   ├── services/            # Business logic
│   ├── workers/             # Background job processors
│   ├── lib/                 # Shared utilities
│   │   ├── db.ts           # Prisma client
│   │   ├── cache.ts        # Redis client
│   │   ├── queue.ts        # BullMQ queues
│   │   └── ai-client.ts    # OpenAI integration
│   ├── db/
│   │   └── schema.prisma   # Database schema
│   ├── config/             # Configuration
│   └── server.ts           # Main entry point
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Development

### Database Migrations

```bash
# Create a new migration
npm run prisma:migrate

# View database in Prisma Studio
npm run prisma:studio
```

### Code Quality

```bash
# Lint code
npm run lint

# Run tests (if configured)
npm test

# Build for production
npm run build
```

## Deployment

### Production with Supabase

1. Set up Supabase project and get connection string
2. Configure environment variables
3. Deploy with Docker:

```bash
# Build production image
docker build -t story-agent-backend .

# Run production container
docker run -d \
  -p 12321:12321 \
  --env-file .env \
  story-agent-backend
```

### With Kubernetes

See `k8s/` directory (if available) for Kubernetes deployment manifests with HPA support.

## Monitoring (Optional)

Start with monitoring profile to enable Prometheus and Grafana:

```bash
docker compose --profile monitoring up -d

# Access Grafana at http://localhost:3001
# Default credentials: admin / admin
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment | No | development |
| `DATABASE_URL` | Supabase Postgres connection | Yes | - |
| `REDIS_URL` | Redis connection | No | redis://redis:6379 |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key | Yes | - |
| `WORKER_CONCURRENCY` | Worker concurrency | No | 5 |
| `AI_CALL_CONCURRENCY` | AI call limit | No | 3 |

## Performance

- **Query endpoints**: P95 < 200ms
- **Mutation endpoints**: P95 < 500ms
- **Async tasks**: Queue wait < 5s, total < 120s
- **Rate limiting**: 100 req/min per IP

## API Specification

The backend implements the V3 API specification as documented in:
- `docs/backend_consolidated.md`
- `docs/BACKEND_API_SPEC_V3_ADDENDUM.md`

Export OpenAPI spec: `http://localhost:12321/docs/json`

## Troubleshooting

### Connection to Supabase fails

Ensure your `DATABASE_URL` includes `?sslmode=require` and your IP is whitelisted in Supabase.

### Redis connection error

If using Docker, ensure Redis container is running:
```bash
docker compose ps
docker compose logs redis
```

### Worker not processing jobs

Check worker logs:
```bash
docker compose logs worker
```

Verify Redis connection and ensure queue is not full.

## License

Proprietary - Story Agent Project

## Support

For issues and questions, contact the development team or refer to project documentation in `/docs`.


