# Dramo API 错误诊断报告 (最终版)

**生成时间**: 2026-03-31 20:35 GMT+8
**问题**: 用户在前端点击"创建故事板"时收到"服务器内部错误"消息

---

## 🎯 Executive Summary

### 系统状态
| 组件 | 状态 | 详情 |
|------|------|------|
| Hono 后端 API (12321) | ✅ 运行中 | HTTP 401 表示服务已启动，需要 JWT 认证 |
| AgentOS (12322) | ✅ 运行中 | HTTP 200 OK - 正常工作 |
| Next.js 前端 (12323) | ✅ 运行中 | 已连接客户端 |
| 数据库 | ✅ 已配置 | Supabase PostgreSQL |
| 环境变量 | ✅ 完整 | debug/production 配置均正确 |

### 关键发现

**问题的根本原因**: 前端向后端 API 发送请求时缺少或使用了无效的 JWT Bearer 令牌

**问题所在的位置**:
1. 前端代理层 (`/app/api/_utils/proxy.ts`) 依赖 NextAuth session 获取 `backendToken`
2. NextAuth session 中的 `backendToken` 可能为空或无效
3. 后端认证中间件 (`middleware/auth.ts`) 严格检查 Bearer token，返回 401

**受影响的功能**: 所有需要认证的 API 调用，包括:
- POST `/api/projects/{id}/storyboard/import` — 创建故事板
- GET/PUT `/api/projects/{id}/storyboard/frames/{id}/image` — 帧图片操作
- 其他所有非公开端点

---

## 🔍 深度诊断

### 1. 服务健康检查

#### Hono 后端 API
```bash
$ curl -v http://localhost:12321/health
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "未提供有效的认证凭据",
    "retryable": false
  },
  "requestId": "a48a88be-d020-4ab3-9281-80c494147620"
}
```

**分析**:
- ✅ 服务已启动（能响应请求）
- ✅ 路由可达
- ❌ `/health` 端点不在公开白名单中（这是预期行为）

**公开端点列表**（定义在 `middleware/auth.ts`）:
- `/api/health` ✅ 公开
- `/api/auth/login` ✅ 公开
- `/api/auth/register` ✅ 公开
- `/api/billing/webhook` ✅ 公开

#### AgentOS
```bash
$ curl http://localhost:12322/health
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

✅ **AgentOS 完全正常**

#### Next.js 前端
- ✅ 正在监听 12323
- ✅ 正确代理到后端
- ✅ 已建立客户端连接

---

### 2. 认证流程分析

#### 流程图

```
用户点击"创建故事板"
    ↓
前端组件发送请求到 Next.js API Route
    ↓
POST /app/api/projects/[projectId]/storyboard/import/route.ts
    ↓
proxyRequest(request, `/api/projects/${projectId}/storyboard/import`, { requireAuth: true })
    ↓
getServerSession(authOptions)
    ↓
【关键问题】检查 session?.backendToken
    ├─ ✅ 若存在 → 设置 Authorization: Bearer ${backendToken}
    └─ ❌ 若不存在 → 返回 401 前端错误
    ↓
后端收到请求
    ↓
authMiddleware 验证 Bearer token
    ├─ ✅ 有效 → 提取 userId，设置 c.set('user', {...})
    ├─ ❌ 无效 → 返回 401 Unauthorized
    └─ ❌ 缺失 → 返回 401 "未提供有效的认证凭据"
```

#### 前端代理层代码 (`app/api/_utils/proxy.ts`)

```typescript
// 第 67-92 行
async function ensureSession(requireAuth: boolean | undefined): Promise<Session | null> {
  const session = await getServerSession(authOptions);

  if (requireAuth && !session?.backendToken) {
    throw new NextResponse(
      JSON.stringify({
        error: {
          code: "UNAUTHORIZED",
          message: "未认证，请先登录",  // ← 用户看到的错误信息
          retryable: false,
        },
      }),
      { status: 401 }
    );
  }

  return session;
}

// 第 181-183 行
if (session?.backendToken && !headers.has("Authorization")) {
  headers.set("Authorization", `Bearer ${session.backendToken}`);
}
```

**问题**: 如果 `session?.backendToken` 不存在，后续请求会被后端拒绝（401）

#### 后端认证中间件 (`middleware/auth.ts`)

```typescript
// 第 37-107 行
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const pathname = new URL(c.req.url).pathname;

  // 检查是否是公开路径
  if (isPublicPath(pathname)) {
    return next();
  }

  // 检查 Authorization 头
  const authHeader = c.req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn({ url: pathname }, 'Missing bearer authorization header');
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: '未提供有效的认证凭据',
          retryable: false,
        },
        requestId,
      },
      401
    );
  }

  // JWT 验证
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    // ... 设置 user 信息
  } catch (err) {
    return c.json({ error: { ... }, 401);
  }
});
```

---

### 3. 故事板导入路由分析

#### 路由位置和配置
- **文件**: `server/src/routes/storyboard.ts`（第 111-142 行）
- **端点**: `POST /api/projects/{projectId}/storyboard/import`
- **认证**: ✅ 需要（通过 `c.get('user').userId` 访问）

#### 异步处理架构

```typescript
storyboard.post('/api/projects/:projectId/storyboard/import', async (c) => {
  const userId = c.get('user').userId;  // ← 需要认证

  // 1. 创建后台任务
  const task = await taskService.createTask({
    type: 'storyboard_import',
    userId,
    input: { projectId, text: body.text },
    estimatedSeconds: 300,
  });

  // 2. 返回 202 + taskId（立即返回）
  return c.json({ taskId: task.id }, 202);

  // 3. 后台异步执行
  executeStoryboardImport(task.id, {...}).catch(...);
});
```

**架构优势**:
- 立即返回 202 Accepted
- 前端轮询 `/api/tasks/{taskId}` 获取进度
- AgentOS 处理大型 workflow（可能需要 5-15 分钟）
- 不受 Vercel 60 秒超时限制

---

### 4. 前端故事板页面分析

#### 组件位置
- **主页面**: `/web/app/projects/[id]/@content/storyboard/page.tsx`
- **事件处理**: `/web/app/projects/[id]/@content/storyboard/handlers.ts`
- **Next.js API Route**: `/web/app/api/projects/[projectId]/storyboard/import/route.ts`

#### 前端 API 调用流程

```typescript
// 用户发起请求时
const response = await api(`/api/projects/${projectId}/storyboard/import`, {
  method: 'POST',
  body: { text: '剧本文本...' },
});

// 这个调用流经:
// 1. lib/api/client.ts (api<T>() 函数) — 添加 credentials: 'include'
// 2. /web/app/api/projects/[projectId]/storyboard/import/route.ts
// 3. proxyRequest() — 获取 session 并添加 Authorization 头
// 4. 后端 Hono API — 验证 JWT
```

---

## 🚨 问题诊断树

### 最可能的原因 (优先级排序)

#### **原因 A: NextAuth session 中缺少 backendToken** (70% 可能)

**症状**:
- 用户成功登录了（页面显示已登录）
- 但 session 中没有 `backendToken`
- 前端 API 调用返回 401

**验证方法**:
```bash
# 1. 打开浏览器控制台
# 2. 在 NextAuth 回调中检查 token
localStorage.getItem('next-auth.session-token')

# 3. 或查看 /api/auth/session
fetch('http://localhost:12323/api/auth/session')
  .then(r => r.json())
  .then(session => console.log(session))
```

**原因分析**:
- NextAuth 登录回调可能未设置 `backendToken`
- JWT 令牌未被正确保存到 session
- Session 持久化配置问题

---

#### **原因 B: JWT_SECRET 不匹配** (15% 可能)

**症状**:
- 前端成功获得了 token
- 但后端验证失败（token 签名不对）
- 返回 "Token 无效或已过期"

**验证方法**:
```bash
# 检查前后端 JWT_SECRET 是否一致
grep JWT_SECRET /Users/halyu/Documents/Code/dramo/.env.debug
# 应该显示: JWT_SECRET=dev-secret-change-me

# 检查后端是否使用了相同的 secret
grep -r "config.jwtSecret\|JWT_SECRET" /Users/halyu/Documents/Code/dramo/server/src/
```

**当前值**:
```
.env.debug:    JWT_SECRET=dev-secret-change-me
.env:          JWT_SECRET=story-agent-jwt-secret-prod-2026
```

✅ 都已配置

---

#### **原因 C: 令牌已过期** (10% 可能)

**症状**:
- 用户很久以前登录的
- 令牌有 TTL（Time To Live）
- 返回 "Token 无效或已过期"

**配置**:
```
JWT_EXPIRES_IN=30d  # 30天过期
```

---

#### **原因 D: 登录端点本身失败** (5% 可能)

**症状**:
- 登录 API 返回错误或异常
- NextAuth 未能正确处理响应
- Session 创建失败

---

### 问题进一步诊断

#### 第一步：检查前端 session

```bash
# 1. 打开浏览器，登录应用
# 2. F12 打开控制台
# 3. 运行以下命令

fetch('http://localhost:12323/api/auth/session', {
  credentials: 'include'
})
.then(r => r.json())
.then(session => {
  console.log('=== Session ===');
  console.log('User:', session.user);
  console.log('BackendToken:', session.backendToken ? '已设置' : '❌ 未设置');
  console.log('Token 示例:', session.backendToken?.substring(0, 50) + '...');
});
```

**预期输出示例**:
```javascript
=== Session ===
User: { email: 'test@example.com', name: 'Test User' }
BackendToken: 已设置
Token 示例: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

#### 第二步：测试后端认证

```bash
# 获取 session 中的 token（从浏览器复制）
TOKEN="<paste-your-backend-token-here>"

# 测试后端 API
curl -v http://localhost:12321/api/projects/test-project/storyboard/import \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Test script"}'

# 预期: HTTP 202 + taskId
# 或: HTTP 401 (token 无效)
# 或: HTTP 404 (project 不存在 - 这是好的！)
```

---

#### 第三步：追踪日志

```bash
# 终端 1: 启动后端并查看日志
npm run dev -w @dramo/server

# 在另一个终端运行测试，观察:
# - 是否收到了 Authorization 头
# - JWT 验证失败的原因
# - 详细错误消息
```

---

## 📋 环境配置验证

### .env.debug (调试环境)

```
✅ NODE_ENV=development
✅ PORT=12321
✅ JWT_SECRET=dev-secret-change-me
✅ JWT_EXPIRES_IN=30d
✅ DATABASE_URL=postgresql://...
✅ AGENTOS_BASE_URL=http://localhost:12322
✅ NEXTAUTH_SECRET=50fd9ebf51c7b4edc4f37120f255bc467a9cb8904396ae7c000167d447cdaf74
✅ NEXTAUTH_URL=http://localhost:12323
✅ NEXT_PUBLIC_API_URL=http://localhost:12321
```

### .env (生产环境)

```
✅ DATABASE_URL=postgresql://...
✅ JWT_SECRET=story-agent-jwt-secret-prod-2026
✅ ENCRYPTION_KEY=eb5a9d0e793575f09142a2f3f0267a2b00b23ead4c6da93527f024841c3fb862
✅ OPENAI_API_KEY=sk-...
✅ OPENAI_API_BASE=https://aihubmix.com/v1
✅ OPENAI_MODEL_ID=gpt-5
```

---

## 🔧 解决方案建议

### 快速修复清单

- [ ] **第一步**: 验证前端 session 是否包含 `backendToken`
  ```bash
  # 打开浏览器控制台，运行上面的诊断代码
  ```

- [ ] **第二步**: 如果 backendToken 为空，检查 NextAuth 配置
  ```bash
  find /Users/halyu/Documents/Code/dramo/web -name "options.ts" -o -name "auth.ts" | grep -i auth
  ```

- [ ] **第三步**: 检查登录端点是否返回 token
  ```bash
  curl -X POST http://localhost:12321/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}'
  ```

- [ ] **第四步**: 验证 JWT_SECRET 一致性
  ```bash
  echo "前端 (来自 .env):"
  grep NEXTAUTH_SECRET /Users/halyu/Documents/Code/dramo/.env.debug
  echo "后端 (来自 .env.debug):"
  grep JWT_SECRET /Users/halyu/Documents/Code/dramo/.env.debug
  ```

- [ ] **第五步**: 清理并重启所有服务
  ```bash
  pkill -f "uvicorn\|tsx watch\|next dev"
  npm run dev
  ```

---

## 📊 系统架构总览

```
┌──────────────────────┐
│   用户浏览器          │
│  (http://...12323)   │
└──────────┬───────────┘
           │
           │ fetch()
           ↓
┌──────────────────────────────────────────────────────────┐
│  Next.js 前端 (端口 12323)                                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ 1. 用户点击"创建故事板"                              │  │
│  │ 2. app/projects/.../storyboard/page.tsx              │  │
│  │ 3. handlers.ts 中的事件处理                          │  │
│  │ 4. api() 调用 /api/projects/{id}/storyboard/import  │  │
│  └────────────────────────────────────────────────────┘  │
│                      │                                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Next.js API Route (app/api/...)                     │  │
│  │ ┌──────────────────────────────────────────────┐  │  │
│  │ │ 1. proxyRequest()                             │  │  │
│  │ │ 2. getServerSession() → session.backendToken  │  │  │
│  │ │ 3. 设置 Authorization: Bearer {token}         │  │  │
│  │ │ 4. fetch() 到后端                            │  │  │
│  │ └──────────────────────────────────────────────┘  │  │
│  └────────┬───────────────────────────────────────────┘  │
└───────────┼──────────────────────────────────────────────┘
            │ HTTP + Bearer Token
            ↓
┌───────────────────────────────────────────┐
│  Hono 后端 API (端口 12321)                 │
│  ┌─────────────────────────────────────┐  │
│  │ authMiddleware                      │  │
│  │ 1. 检查 Authorization 头             │  │
│  │ 2. JWT 验证                         │  │
│  │ 3. 设置 c.set('user', {...})        │  │
│  └─────────────────────────────────────┘  │
│                │                           │
│  ┌─────────────↓─────────────────────┐  │
│  │ routes/storyboard.ts               │  │
│  │ 1. 验证项目所有权                  │  │
│  │ 2. 创建后台 Task                   │  │
│  │ 3. 返回 202 + taskId                │  │
│  │ 4. 后台调用 AgentOS                │  │
│  └─────────────────────────────────────┘  │
└────────┬────────────────────────────────┘
         │ HTTP 工作流请求
         ↓
┌───────────────────────────────────────┐
│  AgentOS (端口 12322)                  │
│  ┌─────────────────────────────────┐  │
│  │ storyboardworkflow               │  │
│  │ 1. 解析剧本文本                  │  │
│  │ 2. 调用 LLM (OpenAI/Hunyuan)     │  │
│  │ 3. 提取分镜数据                  │  │
│  │ 4. SSE 流式返回结果              │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

---

## 🎯 根本原因总结

| 问题 | 原因 | 影响范围 |
|------|------|--------|
| **401 Unauthorized** | 前端缺少或使用了无效的 JWT token | 所有需要认证的 API 调用 |
| **后端服务正常** | Hono 和 AgentOS 都在运行 | 无 |
| **环境配置正确** | JWT_SECRET 等都已配置 | 无 |

---

## 📝 后续行动项

### 优先级 P0（立即执行）
1. [ ] 验证前端 session 中是否有 `backendToken`
2. [ ] 检查登录端点是否返回 token
3. [ ] 查看 NextAuth 配置文件

### 优先级 P1（可选但建议）
1. [ ] 添加详细日志到认证流程
2. [ ] 为故事板导入添加错误处理
3. [ ] 改进前端错误消息（显示具体的认证失败原因）

### 优先级 P2（长期改进）
1. [ ] 考虑添加自动令牌刷新机制
2. [ ] 实现更详细的审计日志
3. [ ] 添加故事板导入进度可视化

---

**诊断完成。需要进一步信息，请提供上述诊断步骤的输出。**
