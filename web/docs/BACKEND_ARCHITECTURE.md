# 高性能后端架构方案

## 概述

本文档提供 AI 直播台本生成助手后端的详细技术架构方案，针对高并发、多用户场景优化，支持异步任务处理与弹性扩展。

**目标 SLO**:
- 查询接口 P95 < 200ms
- 变更接口 P95 < 500ms
- 任务队列等待 < 5s
- 完整台本生成 < 120s
- 系统可用性 > 99.5%

---

## 架构概览

```
┌─────────┐
│ Client  │
└────┬────┘
     │
     ↓
┌─────────────────┐
│ Nginx/Cloudflare│  ← 限流、缓存、SSL
└────┬────────────┘
     │
     ↓
┌──────────────────────┐
│  API Service (Node)  │  ← Fastify + TypeScript
│  - 认证/鉴权          │
│  - 参数校验           │
│  - 业务逻辑           │
│  - 任务分发           │
└──┬────────────┬──────┘
   │            │
   ↓            ↓
┌──────┐    ┌─────────┐
│ PG   │    │ Redis   │
│ 主从  │    │ - 缓存   │
└──────┘    │ - 队列   │
            │ - 幂等   │
            └────┬────┘
                 │
                 ↓
         ┌──────────────┐
         │ Worker Pool  │  ← 独立进程
         │ - AI 调用     │
         │ - 重试逻辑    │
         │ - 结果回写    │
         └──────┬───────┘
                │
                ↓
         ┌─────────────┐
         │ AI Service  │  ← OpenAI/自建 LLM
         └─────────────┘
```

---

## 技术栈

### 核心组件

| 组件 | 技术选型 | 版本 | 原因 |
|------|---------|------|------|
| **网关** | Nginx | 1.24+ | 成熟稳定、限流、缓存、反向代理 |
| **API 服务** | Node.js + Fastify | 20 LTS + 4.x | 高性能、与前端同栈、生态丰富 |
| **语言** | TypeScript | 5.x | 类型安全、减少运行时错误 |
| **数据库** | PostgreSQL | 15+ | ACID、复杂查询、JSON 支持 |
| **缓存/队列** | Redis | 7.x | 高性能、持久化、Pub/Sub |
| **队列库** | BullMQ | 5.x | 基于 Redis、重试、延时、优先级 |
| **ORM** | Prisma | 5.x | 类型安全、迁移管理、性能优秀 |
| **认证** | jsonwebtoken | 9.x | JWT 标准、无状态 |
| **观测** | OpenTelemetry | 1.x | 标准化追踪、指标、日志 |
| **日志** | Pino | 8.x | 高性能结构化日志 |
| **容器** | Docker | 24+ | 标准化部署、环境一致性 |
| **编排** | Kubernetes | 1.28+ | 自动扩缩、服务发现、健康检查 |

### 依赖服务

- **AI 服务**: OpenAI API / Azure OpenAI / 自建 LLM
- **监控**: Prometheus + Grafana
- **日志聚合**: Loki / ELK
- **追踪**: Jaeger / Tempo
- **告警**: AlertManager

---

## 详细设计

### 1. API 服务层

#### 1.1 目录结构

```
backend/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── scripts.ts
│   │   │   ├── inspirations.ts
│   │   │   ├── personas.ts
│   │   │   └── tasks.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts
│   │   │   ├── ratelimit.ts
│   │   │   ├── validation.ts
│   │   │   └── error-handler.ts
│   │   └── schemas/
│   │       └── openapi.json
│   ├── services/
│   │   ├── project.service.ts
│   │   ├── script.service.ts
│   │   ├── inspiration.service.ts
│   │   └── task.service.ts
│   ├── workers/
│   │   ├── script-generator.worker.ts
│   │   ├── scene-regenerator.worker.ts
│   │   └── inspiration-refresher.worker.ts
│   ├── lib/
│   │   ├── ai-client.ts
│   │   ├── queue.ts
│   │   ├── cache.ts
│   │   └── telemetry.ts
│   ├── db/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── config/
│   │   └── index.ts
│   └── server.ts
├── tests/
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

#### 1.2 核心代码示例

**服务器启动** (`src/server.ts`):

```typescript
import Fastify from 'fastify';
import { registerRoutes } from './api/routes';
import { authMiddleware } from './api/middleware/auth';
import { rateLimitMiddleware } from './api/middleware/ratelimit';
import { errorHandler } from './api/middleware/error-handler';
import { initTelemetry } from './lib/telemetry';
import { config } from './config';

const server = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.isDev ? { target: 'pino-pretty' } : undefined,
  },
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
});

// 中间件
server.register(authMiddleware);
server.register(rateLimitMiddleware);

// 路由
registerRoutes(server);

// 错误处理
server.setErrorHandler(errorHandler);

// 健康检查
server.get('/api/health', async () => ({
  ok: true,
  version: config.version,
  uptimeSeconds: process.uptime(),
  timestamp: new Date().toISOString(),
}));

// 优雅关闭
process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

// 启动
const start = async () => {
  try {
    initTelemetry();
    await server.listen({ port: config.port, host: '0.0.0.0' });
    server.log.info(`Server listening on ${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
```

**认证中间件** (`src/api/middleware/auth.ts`):

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { config } from '../../config';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 跳过健康检查
  if (request.url === '/api/health') {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: '未提供有效的认证凭据',
        retryable: false,
      },
      requestId: request.id,
    });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      userId: string;
      email: string;
    };
    request.user = decoded;
  } catch (err) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token 无效或已过期',
        retryable: false,
      },
      requestId: request.id,
    });
  }
}
```

**限流中间件** (`src/api/middleware/ratelimit.ts`):

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../../lib/cache';

const limiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit',
  points: 100, // 请求数
  duration: 60, // 时间窗口（秒）
});

export async function rateLimitMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (request.url === '/api/health') {
    return;
  }

  const key = request.user?.userId || request.ip;
  try {
    const rateLimitRes = await limiter.consume(key);
    
    reply.header('X-RateLimit-Limit', 100);
    reply.header('X-RateLimit-Remaining', rateLimitRes.remainingPoints);
    reply.header('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + rateLimitRes.msBeforeNext / 1000);
  } catch (err: any) {
    reply.header('X-RateLimit-Limit', 100);
    reply.header('X-RateLimit-Remaining', 0);
    reply.header('X-RateLimit-Reset', Math.floor(Date.now() / 1000) + err.msBeforeNext / 1000);
    reply.header('Retry-After', Math.ceil(err.msBeforeNext / 1000));
    
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMITED',
        message: '请求频率超限，请稍后再试',
        retryable: true,
      },
      requestId: request.id,
    });
  }
}
```

**任务队列** (`src/lib/queue.ts`):

```typescript
import { Queue, Worker, Job } from 'bullmq';
import { redis } from './cache';
import { logger } from './logger';

export const scriptQueue = new Queue('script-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 86400, // 保留 24 小时
    },
    removeOnFail: {
      age: 86400 * 7, // 保留 7 天
    },
  },
});

export async function enqueueScriptGeneration(data: {
  scriptId: string;
  projectId: string;
  title: string;
  parameters: any;
}) {
  const job = await scriptQueue.add('generate', data, {
    jobId: `script_${data.scriptId}`,
    priority: 1,
  });
  
  logger.info({ jobId: job.id }, 'Script generation job enqueued');
  return job.id;
}

export function createScriptWorker() {
  return new Worker(
    'script-generation',
    async (job: Job) => {
      logger.info({ jobId: job.id }, 'Processing script generation');
      
      // 更新进度
      await job.updateProgress(10);
      
      // 调用 AI 服务生成台本
      const result = await generateScriptWithAI(job.data);
      
      await job.updateProgress(100);
      return result;
    },
    {
      connection: redis,
      concurrency: 5, // 并发处理 5 个任务
      limiter: {
        max: 10, // 每秒最多 10 个任务
        duration: 1000,
      },
    }
  );
}
```

**AI 客户端** (`src/lib/ai-client.ts`):

```typescript
import OpenAI from 'openai';
import pLimit from 'p-limit';
import { config } from '../config';
import { logger } from './logger';

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  timeout: 60000,
  maxRetries: 3,
});

// 限制并发 AI 调用
const limit = pLimit(5);

export async function generateScript(params: {
  topic: string;
  goal: string;
  style: string;
}): Promise<any> {
  return limit(async () => {
    const startTime = Date.now();
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的直播台本编剧...',
          },
          {
            role: 'user',
            content: `生成一个${params.style}风格的直播台本，主题：${params.topic}，目标：${params.goal}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });
      
      const duration = Date.now() - startTime;
      logger.info({ duration, model: 'gpt-4-turbo' }, 'AI generation succeeded');
      
      return parseScriptFromAI(response.choices[0].message.content);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      logger.error({ err, duration }, 'AI generation failed');
      
      if (err.status === 429) {
        throw new Error('UPSTREAM_RATE_LIMITED');
      } else if (err.code === 'ETIMEDOUT') {
        throw new Error('UPSTREAM_TIMEOUT');
      }
      throw err;
    }
  });
}
```

### 2. 数据库设计

#### 2.1 Schema (Prisma)

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  projects  Project[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  scripts     Script[]
  
  @@index([userId])
}

model Script {
  id         String   @id @default(cuid())
  title      String
  projectId  String
  type       String
  style      String
  status     String   @default("draft")
  scenes     Json     // 存储为 JSONB
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@index([projectId])
  @@index([status])
}

model Task {
  id               String   @id @default(cuid())
  type             String   // 'script_generation' | 'scene_regeneration' | 'inspiration_refresh'
  status           String   @default("queued") // 'queued' | 'running' | 'succeeded' | 'failed'
  progress         Int      @default(0)
  input            Json
  result           Json?
  error            Json?
  userId           String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  estimatedSeconds Int?
  
  @@index([userId, status])
  @@index([createdAt])
}

model Inspiration {
  id         String   @id @default(cuid())
  text       String
  category   String
  relevance  Float?
  source     String?
  projectId  String?
  createdAt  DateTime @default(now())
  
  @@index([projectId])
  @@index([category])
}
```

#### 2.2 连接池配置

```typescript
// src/lib/db.ts
import { PrismaClient } from '@prisma/client';
import { config } from '../config';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
  log: config.isDev ? ['query', 'error', 'warn'] : ['error'],
});

// 连接池配置（通过 DATABASE_URL）
// postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=30
```

#### 2.3 读写分离

```typescript
// src/lib/db.ts
export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseReadUrl, // 从库地址
    },
  },
});

export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseWriteUrl, // 主库地址
    },
  },
});
```

### 3. 缓存策略

#### 3.1 Redis 配置

```typescript
// src/lib/cache.ts
import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis({
  host: config.redisHost,
  port: config.redisPort,
  password: config.redisPassword,
  db: 0,
  retryStrategy: (times) => Math.min(times * 50, 2000),
  maxRetriesPerRequest: 3,
});

// 缓存包装器
export async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  const result = await fn();
  await redis.setex(key, ttl, JSON.stringify(result));
  return result;
}
```

#### 3.2 缓存策略

| 数据类型 | TTL | 失效策略 |
|---------|-----|---------|
| 项目列表 | 5 分钟 | 写入时失效 |
| 项目详情 | 10 分钟 | 更新时失效 |
| 台本详情 | 5 分钟 | 更新时失效 |
| 灵感推荐 | 30 分钟 | 刷新时失效 |
| 人设列表 | 1 小时 | 很少变更 |
| 任务状态 | 30 秒 | 轮询频繁 |

### 4. 部署配置

#### 4.1 Docker Compose (开发环境)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://user:pass@postgres:5432/scriptgen
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src

  worker:
    build: .
    command: npm run worker
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://user:pass@postgres:5432/scriptgen
      REDIS_URL: redis://redis:6379
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: scriptgen
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin

volumes:
  postgres_data:
  redis_data:
```

#### 4.2 Kubernetes 部署

**API Deployment**:

```yaml
# k8s/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: scriptgen-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Worker Deployment**:

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: worker
  template:
    metadata:
      labels:
        app: worker
    spec:
      containers:
      - name: worker
        image: scriptgen-worker:latest
        command: ["npm", "run", "worker"]
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: worker-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: worker
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: redis_queue_length
      target:
        type: AverageValue
        averageValue: "50"
```

### 5. 监控与告警

#### 5.1 Prometheus 配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'

  - job_name: 'worker'
    static_configs:
      - targets: ['worker:3000']
    metrics_path: '/metrics'

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

#### 5.2 关键指标

**API 指标**:
- `http_request_duration_seconds` - 请求延迟分布
- `http_requests_total` - 请求总数（按路径、状态码）
- `http_request_errors_total` - 错误总数
- `active_connections` - 活跃连接数

**Worker 指标**:
- `queue_job_duration_seconds` - 任务处理时长
- `queue_job_total` - 任务总数（按状态）
- `queue_length` - 队列长度
- `ai_call_duration_seconds` - AI 调用延迟
- `ai_call_errors_total` - AI 调用失败数

**数据库指标**:
- `db_connections_active` - 活跃连接数
- `db_query_duration_seconds` - 查询延迟
- `db_pool_wait_duration_seconds` - 连接池等待时长

#### 5.3 告警规则

```yaml
# alerts.yml
groups:
  - name: api_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_request_errors_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "API 错误率过高"
          description: "5 分钟内错误率超过 5%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API P95 延迟过高"
          description: "P95 延迟超过 1 秒"

      - alert: QueueBacklog
        expr: queue_length > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "任务队列积压"
          description: "队列长度超过 100"

      - alert: AIServiceDown
        expr: rate(ai_call_errors_total[5m]) > 0.5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "AI 服务异常"
          description: "AI 调用失败率超过 50%"
```

---

## 性能优化

### 1. 数据库优化

**索引策略**:
```sql
-- 项目查询
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at DESC);

-- 台本查询
CREATE INDEX idx_scripts_project_id ON scripts(project_id);
CREATE INDEX idx_scripts_status ON scripts(status);
CREATE INDEX idx_scripts_updated_at ON scripts(updated_at DESC);

-- 任务查询
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- JSONB 索引（场景搜索）
CREATE INDEX idx_scripts_scenes_gin ON scripts USING GIN (scenes);
```

**查询优化**:
- 使用 `EXPLAIN ANALYZE` 分析慢查询
- 避免 N+1 查询（使用 `include`）
- 分页使用游标而非 OFFSET（大数据集）
- 定期 `VACUUM` 和 `ANALYZE`

### 2. 缓存优化

**多级缓存**:
```
[内存缓存 (LRU)] → [Redis] → [数据库]
     ↑ 热点数据           ↑ 通用缓存
```

**缓存预热**:
- 启动时加载热门项目/人设
- 定时任务刷新灵感推荐
- 用户登录时预加载常用数据

### 3. 并发控制

**AI 调用限流**:
```typescript
const aiLimiter = pLimit(5); // 最多 5 个并发 AI 调用

async function generateWithLimit(params: any) {
  return aiLimiter(() => callAI(params));
}
```

**数据库连接池**:
```
API 实例：20 连接
Worker 实例：10 连接
总计：30-50 连接（根据负载调整）
```

---

## 安全措施

### 1. 认证与授权

- JWT Token（15 分钟过期 + Refresh Token）
- 密码使用 bcrypt（cost=12）
- API Key 用于服务间调用
- RBAC 权限模型（管理员/普通用户）

### 2. 输入校验

- 使用 JSON Schema 校验请求体
- 参数长度/范围限制
- SQL 注入防护（ORM 参数化查询）
- XSS 防护（输出转义）

### 3. 限流与防护

- 全局限流：100 req/min/IP
- 用户限流：1000 req/hour/user
- 生成接口特殊限流：10 req/hour/user
- DDoS 防护（Cloudflare）

### 4. 数据安全

- 数据库加密（at rest）
- 传输加密（TLS 1.3）
- 敏感字段加密（AES-256）
- 定期备份（每日全量 + 实时增量）

---

## 成本估算

### 小规模（< 1000 用户）

| 资源 | 配置 | 月成本（USD） |
|------|------|--------------|
| API 服务器 | 2 × 2 core | $40 |
| Worker 服务器 | 2 × 2 core | $40 |
| PostgreSQL | 1 主 + 1 从 | $60 |
| Redis | 1 实例 | $20 |
| 负载均衡 | 基础 | $20 |
| AI API (OpenAI) | ~100K tokens/day | $150 |
| **总计** | | **~$330/月** |

### 中规模（1000-10000 用户）

| 资源 | 配置 | 月成本（USD） |
|------|------|--------------|
| API 服务器 | 5 × 2 core | $100 |
| Worker 服务器 | 5 × 2 core | $100 |
| PostgreSQL | 1 主 + 2 从 | $120 |
| Redis | 主从 | $40 |
| 负载均衡 | 标准 | $40 |
| AI API (OpenAI) | ~1M tokens/day | $1500 |
| CDN/存储 | 基础 | $50 |
| **总计** | | **~$1950/月** |

---

## Python AgentOS 融合方案（可选）

### 概述

对于需要复杂多智能体编排、快速迭代 AI 逻辑的场景，可引入 [Agno AgentOS](https://docs.agno.com/introduction) 作为 AI 计算侧车（Sidecar）微服务，与现有 Node.js 架构共存。

**核心原则**：
- Node.js 保持统一 API 门面、鉴权、限流、幂等与错误模型
- AgentOS 专注 AI 生成逻辑、多智能体协作与工具链编排
- 对外 OpenAPI 契约不变，前端无感知

### 融合架构图

```
[Client] → [Nginx] → [Node API] → [PostgreSQL]
                          ↓             ↓
                     [Redis Queue] [Redis Cache]
                          ↓
                   [Node Worker Pool]
                          ↓
                   ┌──────┴──────┐
                   ↓             ↓
            [Node AI Logic]  [AgentOS (FastAPI)]
            (旧实现/灰度)         ↓
                              [Agno Agent]
                                  ↓
                              [LLM API]
```

**链路说明**：
1. 前端请求 → Node API → 入队（BullMQ）
2. Node Worker 拉取任务 → 按策略路由到 AgentOS 或 Node 实现
3. AgentOS 调用 LLM → 返回结构化结果
4. Node Worker 归一化响应 → 回写任务状态（DB/Redis）
5. 前端轮询 `GET /api/tasks/{taskId}` 获取结果

### 为什么选择 AgentOS

| 优势 | 说明 |
|------|------|
| **多智能体能力** | 内置 Agent/Team/Workflow 抽象，支持复杂协作 |
| **Python 生态** | 丰富的 LLM/向量/评估工具链，迭代快 |
| **内置 FastAPI** | 开箱即用的 HTTP 接口与健康检查 |
| **可观测性** | 自带 UI 与追踪，便于调试与监控 |
| **解耦风险** | AI 逻辑变更不影响 API 契约与限流策略 |

### 集成方式（Sidecar 模式）

#### 1. 服务间通信

**Node Worker → AgentOS**:
```typescript
// src/lib/agentos-client.ts
import fetch from 'node-fetch';

export async function callAgentOS<T>(
  path: string,
  body: unknown,
  opts?: { timeoutMs?: number; requestId?: string }
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 65000);
  
  try {
    const res = await fetch(`${process.env.AGENTOS_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': opts?.requestId ?? '',
        'traceparent': opts?.traceparent ?? '', // OTel 追踪
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    
    if (!res.ok) {
      throw new Error(`AGENTOS_${res.status}`);
    }
    
    return await res.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}
```

#### 2. 错误映射

**AgentOS → Node 统一错误模型**:

| AgentOS 状态 | Node 错误码 | retryable |
|-------------|------------|-----------|
| 400/422 | INVALID_INPUT | false |
| 404 | NOT_FOUND | false |
| 408/499 | UPSTREAM_TIMEOUT | true |
| 429 | RATE_LIMITED | true |
| 5xx | INTERNAL_ERROR | true |

```typescript
// src/workers/error-mapper.ts
export function mapAgentOSError(err: Error): { code: string; retryable: boolean } {
  const msg = err.message;
  
  if (/AGENTOS_400|AGENTOS_422/.test(msg)) {
    return { code: 'INVALID_INPUT', retryable: false };
  }
  if (/AGENTOS_404/.test(msg)) {
    return { code: 'NOT_FOUND', retryable: false };
  }
  if (/AGENTOS_429/.test(msg)) {
    return { code: 'RATE_LIMITED', retryable: true };
  }
  if (/AGENTOS_5\d\d|abort/.test(msg)) {
    return { code: 'UPSTREAM_TIMEOUT', retryable: true };
  }
  
  return { code: 'INTERNAL_ERROR', retryable: true };
}
```

#### 3. 并发与超时控制

**Node Worker 侧**:
```typescript
import pLimit from 'p-limit';

const agentosLimiter = pLimit(5); // 最多 5 个并发调用

export async function generateScriptWithAgentOS(params: any) {
  return agentosLimiter(async () => {
    return callAgentOS('/agentos/generate_script', params, {
      timeoutMs: 60000,
      requestId: params.requestId,
    });
  });
}
```

**AgentOS 侧**:
- 每实例限制 3-5 个并发 LLM 调用
- 单次 LLM 调用超时 60 秒
- 使用 `p-limit` 或 Agno 内置并发控制

#### 4. 重试与断路器

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(callAgentOS, {
  timeout: 65000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 秒后尝试恢复
});

breaker.on('open', () => {
  logger.warn('AgentOS circuit breaker opened, falling back to Node implementation');
});

export async function callAgentOSWithBreaker<T>(path: string, body: unknown) {
  try {
    return await breaker.fire(path, body) as T;
  } catch (err) {
    // 断路器打开时，回退到 Node 实现
    return fallbackToNodeImplementation(body);
  }
}
```

### 安全与认证

**服务间认证**:
- **开发环境**: 内网直连，无需认证
- **生产环境**: 
  - 方案 1: mTLS（双向证书验证）
  - 方案 2: 服务 JWT（短 TTL、受众限制）

```typescript
// 服务 JWT 示例
const serviceToken = jwt.sign(
  { service: 'node-worker', audience: 'agentos' },
  process.env.SERVICE_JWT_SECRET,
  { expiresIn: '5m' }
);

headers: {
  'Authorization': `Bearer ${serviceToken}`,
}
```

### 可观测性

#### 指标（Prometheus）

**Node Worker**:
```typescript
const agentosHttpDuration = new Histogram({
  name: 'agentos_http_duration_seconds',
  help: 'AgentOS HTTP call duration',
  labelNames: ['path', 'status'],
});

const agentosHttpErrors = new Counter({
  name: 'agentos_http_errors_total',
  help: 'AgentOS HTTP call errors',
  labelNames: ['path', 'code'],
});
```

**AgentOS**:
- `ai_call_duration_seconds{model}` - LLM 调用延迟
- `ai_call_errors_total{code}` - LLM 调用失败数
- `agent_jobs_inflight` - 进行中的任务数

#### 追踪（OpenTelemetry）

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('node-worker');

export async function callAgentOSWithTrace<T>(path: string, body: unknown) {
  return tracer.startActiveSpan('agentos.call', async (span) => {
    span.setAttribute('agentos.path', path);
    
    try {
      const result = await callAgentOS<T>(path, body, {
        traceparent: span.spanContext().traceId,
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
```

### 灰度与回滚

#### 灰度策略

```typescript
// src/workers/strategy.ts
export function shouldUseAgentOS(taskType: string, userId: string): boolean {
  // 按任务类型灰度
  if (taskType === 'script_generation') {
    return Math.random() < 0.1; // 10% 流量
  }
  
  // 按用户 ID 灰度（一致性哈希）
  const hash = hashCode(userId);
  return hash % 100 < 10; // 10% 用户
  
  // 或从配置中心读取灰度比例
  return config.agentosGrayRatio > Math.random();
}

export async function handleTask(job: Job) {
  if (shouldUseAgentOS(job.data.type, job.data.userId)) {
    return handleWithAgentOS(job);
  } else {
    return handleWithNode(job);
  }
}
```

#### 回滚触发条件

- AgentOS 错误率 > 10%（5 分钟窗口）
- P95 延迟 > 90 秒
- 断路器连续打开 3 次

```typescript
if (agentosErrorRate > 0.1 || agentosP95 > 90000) {
  logger.error('AgentOS degraded, switching to Node implementation');
  config.agentosGrayRatio = 0; // 关闭灰度
}
```

### 容量规划

| 组件 | 配置 | 说明 |
|------|------|------|
| AgentOS 实例 | 2 core × 2 实例 | 每实例 3-5 LLM 并发 |
| Node Worker | 保持不变 | 增加 AgentOS 调用逻辑 |
| 网络延迟 | < 10ms | 内网通信 |
| 总延迟增加 | < 50ms | HTTP 往返 + 序列化 |

**扩容触发**:
- AgentOS CPU > 70%
- 队列等待时间 > 10s
- LLM 调用排队 > 5 个

### 部署配置

#### Docker Compose（开发环境）

```yaml
# docker-compose.yml
services:
  agentos:
    build: ./agentos
    ports:
      - "8000:8000"
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      LOG_LEVEL: debug
    volumes:
      - ./agentos:/app
    command: uvicorn app:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build: ./backend
    environment:
      AGENTOS_BASE_URL: http://agentos:8000
    depends_on:
      - agentos
      - redis
```

#### Kubernetes（生产环境）

```yaml
# k8s/agentos-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentos
spec:
  replicas: 2
  selector:
    matchLabels:
      app: agentos
  template:
    metadata:
      labels:
        app: agentos
    spec:
      containers:
      - name: agentos
        image: agentos:latest
        ports:
        - containerPort: 8000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: agentos-service
spec:
  selector:
    app: agentos
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agentos-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agentos
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 成本对比

| 方案 | 小规模 | 中规模 | 说明 |
|------|--------|--------|------|
| 纯 Node | $330/月 | $1950/月 | 基线 |
| Node + AgentOS | $370/月 (+12%) | $2150/月 (+10%) | 增加 2 个 AgentOS 实例 |

**成本增加原因**:
- AgentOS 实例资源（2 core × 2）
- 略高的网络开销

**收益**:
- AI 迭代速度提升 50%+
- 多智能体能力
- Python 生态工具链

### 最佳实践

1. **渐进式引入**: 从单一任务类型（如灵感刷新）开始灰度
2. **保留回退**: 始终保持 Node 实现可用
3. **监控先行**: 在灰度前部署完整监控与告警
4. **压测验证**: 在生产前进行充分的负载测试
5. **文档同步**: 更新运维手册与故障排查指南

### 何时不推荐

- 团队缺少 Python 生产运维经验
- 对"统一技术栈"有强合规要求
- AI 逻辑简单，不需要多智能体编排
- 短期内无法投入额外的基础设施成本

### 参考资源

- [Agno 官方文档](https://docs.agno.com/introduction)
- [AgentOS 快速开始](https://docs.agno.com/quickstart)
- [集成示例代码](../AGENTOS_INTEGRATION.md)

---

## 总结

本架构方案通过以下设计实现高性能与高并发：

1. **异步解耦**: 长耗时任务通过队列异步处理，释放 API 吞吐
2. **水平扩展**: API/Worker 无状态设计，支持弹性扩缩
3. **多级缓存**: 减少数据库压力，提升响应速度
4. **读写分离**: 查询走从库，变更走主库，提升并发能力
5. **限流保护**: 防止滥用，保障服务稳定性
6. **可观测性**: 全链路追踪与监控，快速定位问题
7. **可选 AI 增强**: 通过 AgentOS 融合，提升 AI 能力与迭代速度

**关键指标承诺**:
- ✅ 查询接口 P95 < 200ms
- ✅ 任务队列等待 < 5s
- ✅ 完整台本生成 < 120s
- ✅ 系统可用性 > 99.5%
- ✅ 支持 1000+ 并发用户

---

*文档版本*: 1.1  
*更新日期*: 2025-10-16  
*维护者*: Backend Team

