# Backend Quick Start Guide

Get the Story Agent backend running in 5 minutes.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Supabase account (or use local Postgres)
- OpenAI API key

## Option 1: Quick Start with Supabase (Recommended)

### 1. Get Supabase Connection String

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings → Database
3. Copy the connection string (URI format)
4. Make sure it ends with `?sslmode=require`

### 2. Configure Environment

```bash
cd backend
cp env.example .env
```

Edit `.env` and set:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require
JWT_SECRET=your-random-secret-here
OPENAI_API_KEY=sk-your-openai-api-key
```

### 3. Start Services

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Start Redis, API, and Workers with Docker
docker compose up -d

# Run database migrations
npm run prisma:migrate

# View logs
docker compose logs -f api
```

### 4. Test the API

Open http://localhost:12321/docs in your browser to see interactive API documentation.

Or test with curl:
```bash
curl http://localhost:12321/api/health
```

## Option 2: Quick Start with Local Postgres

If you don't have Supabase or want to develop offline:

```bash
cd backend
cp env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/story_agent
JWT_SECRET=dev-secret-123
JWT_EXPIRES_IN=30d
OPENAI_API_KEY=sk-your-openai-api-key
```

Start with local Postgres:
```bash
# Start everything including local Postgres
docker compose --profile localpg up -d

# Wait 10 seconds for Postgres to initialize
sleep 10

# Run migrations
npm run prisma:migrate

# Verify
curl http://localhost:12321/api/health
```

## Next Steps

### Create a Test User Token

For development, generate a simple JWT:

```bash
node -e "console.log(require('jsonwebtoken').sign({userId:'user1',email:'test@example.com'},process.env.JWT_SECRET||'dev-secret-123',{expiresIn:process.env.JWT_EXPIRES_IN||'30d'}))"
```

Save the token and use it in requests:
```bash
TOKEN="your-generated-token"
curl -H "Authorization: Bearer $TOKEN" http://localhost:12321/api/projects
```

### Create a Project

```bash
curl -X POST http://localhost:12321/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My First Project","description":"Test project"}'
```

### Generate a Script (Async)

```bash
curl -X POST http://localhost:12321/api/projects/{PROJECT_ID}/script \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Product Launch Live",
    "source": "structured",
    "form": "live_stream",
    "contentType": "product_launch",
    "goal": "Introduce new product features"
  }'
```

In production mode, this returns a `taskId`. Check status:
```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:12321/api/tasks/{TASK_ID}
```

## Development Workflow

### Local Development (without Docker)

```bash
# Terminal 1: Start API server
npm run dev

# Terminal 2: Start workers
npm run worker

# Terminal 3: Start Redis (or use Docker)
docker run -d -p 6379:6379 redis:7-alpine
```

### View Database

```bash
npm run prisma:studio
```

Opens Prisma Studio at http://localhost:5555

### Check Logs

```bash
# All services
docker compose logs -f

# API only
docker compose logs -f api

# Workers only
docker compose logs -f worker
```

### Stop Services

```bash
docker compose down
```

## Troubleshooting

### "Connection refused" to database

- Check `DATABASE_URL` in `.env` is correct
- For Supabase: Verify your IP is whitelisted
- For local: Ensure Postgres container is running: `docker compose ps`

### "Failed to connect to Redis"

```bash
docker compose up -d redis
docker compose logs redis
```

### Workers not processing jobs

```bash
# Check worker logs
docker compose logs worker

# Restart workers
docker compose restart worker
```

### OpenAI API errors

- Verify `OPENAI_API_KEY` in `.env` is valid
- Check your OpenAI account has credits

## Production Deployment

For production deployment on cloud platforms, see [README.md](./README.md) deployment section.

Key production changes:
1. Set `NODE_ENV=production` 
2. Use strong `JWT_SECRET`
3. Enable SSL on database connection
4. Configure rate limiting appropriately
5. Set up monitoring (Prometheus/Grafana)

## API Documentation

Full interactive API docs: http://localhost:12321/docs

Export OpenAPI spec:
```bash
curl http://localhost:12321/docs/json > openapi.json
```

## Support

- Backend architecture: See `docs/BACKEND_ARCHITECTURE.md` in parent directory
- API specification: See `docs/backend_consolidated.md`
- Issues: Contact development team


