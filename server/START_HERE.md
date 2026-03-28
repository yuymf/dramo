# 🚀 Start Here - Backend Quick Reference

Welcome to the Story Agent standalone backend service!

## ⚡ Fastest Way to Get Started

```bash
# 1. Setup environment
cd backend
cp env.example .env
# Edit .env - add your DATABASE_URL and OPENAI_API_KEY

# 2. Start everything
docker compose up -d

# 3. Test
curl http://localhost:12321/api/health
```

**Done!** Your backend is running.

API Docs: http://localhost:12321/docs

## 📖 Documentation Map

Choose based on your goal:

| I Want To... | Read This |
|--------------|-----------|
| **Get started quickly** | [QUICKSTART.md](./QUICKSTART.md) |
| **Understand the full system** | [README.md](./README.md) |
| **See technical details** | [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) |
| **Deploy to production** | [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) |
| **Move to separate repo** | [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) |

## 🎯 Common Tasks

### Development
```bash
npm install              # Install dependencies
npm run dev             # Start dev server (hot reload)
npm run worker          # Start workers (separate terminal)
```

### Docker
```bash
docker compose up -d              # Start all services
docker compose logs -f api        # View API logs
docker compose logs -f worker     # View worker logs
docker compose down               # Stop all services
```

### Database
```bash
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run migrations
npm run prisma:studio      # Open database GUI
```

### Testing
```bash
# Generate test JWT (respects JWT_EXPIRES_IN when set)
node -e "console.log(require('jsonwebtoken').sign({userId:'test',email:'test@example.com'},'dev-secret-123',{expiresIn:process.env.JWT_EXPIRES_IN||'30d'}))"

# Test with curl (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" http://localhost:12321/api/projects
```

## 🔧 Configuration

Edit `.env` file:

**Required**:
- `DATABASE_URL` - Your Supabase Postgres connection
- `OPENAI_API_KEY` - OpenAI API key

**Optional**:
- `JWT_SECRET` - Custom JWT secret (default: dev-secret-123)
- `JWT_EXPIRES_IN` - Access token lifetime, e.g. 30d/12h (default: 30d)
- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging verbosity (default: info)

## 📊 Architecture Overview

```
[Frontend] → [Fastify API] → [Supabase Postgres]
                   ↓
              [Redis Cache]
                   ↓
             [BullMQ Queue]
                   ↓
            [Worker Pool] → [OpenAI API]
```

## 🌐 API Endpoints

Key endpoints (30+ total):

- `GET /api/health` - Health check
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id/script` - Get script
- `POST /api/projects/:id/script` - Generate script
- `GET /api/tasks/:taskId` - Query task status

Full docs: http://localhost:12321/docs

## 🐛 Troubleshooting

**Problem**: Services won't start  
**Solution**: Check Docker is running, ports 12321, 12322 & 6379 are free

**Problem**: Database connection fails  
**Solution**: Verify `DATABASE_URL` in `.env`, check Supabase IP whitelist

**Problem**: Workers not processing  
**Solution**: Check Redis is running: `docker compose ps redis`

**Problem**: API returns 401  
**Solution**: Check JWT token is valid and not expired

## 📞 Need Help?

1. Check the relevant documentation file
2. View API docs at `/docs` endpoint
3. Check logs: `docker compose logs -f`
4. Review parent directory docs: `../docs/`

## ✅ Quick Health Check

Run these to verify everything works:

```bash
# 1. Services running?
docker compose ps

# 2. Health check?
curl http://localhost:12321/api/health

# 3. Redis working?
docker exec -it $(docker compose ps -q redis) redis-cli ping

# 4. Database connected?
npm run prisma:studio
```

## 🎓 Key Features

- ✅ Async task processing (script generation, etc.)
- ✅ JWT authentication
- ✅ Rate limiting (100 req/min)
- ✅ Idempotency support
- ✅ Unified error handling
- ✅ OpenAI GPT-4 integration
- ✅ Docker one-command deploy
- ✅ Swagger API docs

## 📦 What's Inside

- **40+ TypeScript files** - Complete implementation
- **10 Prisma models** - Full data schema
- **30+ API endpoints** - V3 specification compliant
- **3 worker types** - Background job processing
- **4 middleware layers** - Auth, rate limit, idempotency, errors
- **5 documentation files** - Comprehensive guides

## 🚀 Next Steps

1. **For Development**: Read [QUICKSTART.md](./QUICKSTART.md)
2. **For Understanding**: Read [README.md](./README.md)
3. **For Production**: Read [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
4. **For Migration**: Read [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

## 💡 Pro Tips

- Use `docker compose --profile localpg up -d` for offline development
- Run `npm run prisma:studio` to visually browse the database
- Check `/docs` endpoint for interactive API testing
- Scale workers with `docker compose up -d --scale worker=5`
- Monitor logs in real-time with `docker compose logs -f`

---

**Ready to build something amazing?** Start with [QUICKSTART.md](./QUICKSTART.md)! 🎉


