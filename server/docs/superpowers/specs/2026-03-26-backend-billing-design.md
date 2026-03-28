# Stripe Billing 后端实现设计

**日期**: 2026-03-26
**状态**: Approved
**项目**: Dramo.ai 后端 (Hono + Prisma + Vercel Serverless)

## 概述

**路径确认**: 前端 `proxyRequest` 调用 `${BACKEND_API_URL}/api/billing/...`（带 `/api/` 前缀），与后端现有路由模式（`/api/projects`、`/api/scripts` 等）一致。

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 订阅状态存储 | 本地数据库（Prisma） + Webhook 同步 | 查询快、不依赖 Stripe API 延迟 |
| Price ID 管理 | 环境变量配置 | 在 Stripe Dashboard 手动创建，简单直接 |
| Feature Gate | 各 service 内检查，非独立中间件 | YAGNI，后续按需提取 |
| Webhook 认证 | Stripe 验签（`stripe.webhooks.constructEvent`） | 标准做法，无需自定义 |

## 数据模型

### Prisma Schema 新增

```prisma
model Subscription {
  id                    String    @id @default(cuid())
  userId                String    @unique
  stripeCustomerId      String    @unique
  stripeSubscriptionId  String?   @unique
  planId                String    @default("free")
  status                String    @default("active")
  billingInterval       String?
  currentPeriodStart    DateTime?
  currentPeriodEnd      DateTime?
  cancelAtPeriodEnd     Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
}
```

### User Model 修改

在 `User` model 中添加反向 relation：

```prisma
model User {
  // ...现有字段
  subscription Subscription?
}
```

### 字段说明

- `userId` `@unique` — 一个用户仅一条订阅记录。Free 用户也有记录（`planId = 'free'`，`stripeSubscriptionId = null`）
- `stripeCustomerId` — 首次 checkout 时由 `stripe.customers.create()` 创建，后续复用
- `stripeSubscriptionId` — Free 用户为 null，付费用户在 `checkout.session.completed` Webhook 时写入
- `planId` — `'free' | 'pro' | 'enterprise'`，由 Webhook 事件同步
- `status` — `'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid' | 'incomplete' | 'incomplete_expired'`
- `cancelAtPeriodEnd` — 用户在 Stripe Portal 请求取消但还没到期

## API 端点

### 1. `GET /api/billing/subscription`

**Auth**: 需要 JWT

**逻辑**:
1. 从数据库查询 `Subscription where { userId }`
2. 如果没有记录，返回默认 free 状态（不创建记录，记录在首次 checkout 时创建）

**响应格式** (匹配前端 `Subscription` 类型):
```json
{
  "planId": "free",
  "status": "active",
  "billingInterval": null,
  "currentPeriodEnd": null,
  "cancelAtPeriodEnd": false
}
```

### 2. `GET /api/billing/usage`

**Auth**: 需要 JWT

**逻辑**:
1. 查询用户的 `planId`（从 Subscription 表或默认 free）
2. 并行查询：`projects.count({ userId })`、`characters count`（两步查询：先查用户 projectIds，再 `characterAsset.count({ projectId: { in: projectIds } })`，因为 CharacterAsset 无直接 User relation）
3. AI 生成次数暂 hardcode 返回 0（TODO: 后续加 `UsageRecord` 表按日/月计量，当前 `aiGenerations.used` 始终为 0）
4. 根据 planId 确定 limit：free 有限额，pro 返回 `null`（无限）

**Plan 限额配置**:
```typescript
const PLAN_LIMITS = {
  free: { projects: 1, characters: 5, aiGenerations: 10 },
  pro: { projects: null, characters: null, aiGenerations: null },
  enterprise: { projects: null, characters: null, aiGenerations: null },
} as const;
```

**响应格式** (匹配前端 `Usage` 类型):
```json
{
  "aiGenerations": { "used": 3, "limit": 10, "resetsAt": "2026-03-27T00:00:00Z" },
  "projects": { "used": 1, "limit": 1 },
  "characters": { "used": 2, "limit": 5 }
}
```

### 3. `POST /api/billing/checkout-session`

**Auth**: 需要 JWT

**请求 Body**:
```json
{ "planId": "pro", "interval": "month" }
```

**逻辑**:
1. 验证 `planId` 和 `interval` 参数
2. 查找现有 Subscription 记录获取 `stripeCustomerId`，或创建新 Stripe Customer（用 `user.email`）
3. 如果是新建 Customer，创建 Subscription 记录（`planId: 'free'`）并存储 `stripeCustomerId`
4. 根据 `interval` 选择对应 Stripe Price ID（从环境变量 `STRIPE_PRICE_PRO_MONTHLY` / `STRIPE_PRICE_PRO_YEARLY`）
5. 调用 `stripe.checkout.sessions.create()`:
   - `mode: 'subscription'`
   - `customer: stripeCustomerId`
   - `line_items: [{ price: priceId, quantity: 1 }]`
   - `success_url: {FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: {FRONTEND_URL}/billing/cancel`
   - `metadata: { userId, planId }`
6. 返回 `{ url: session.url }`

**错误处理**:
- 已是活跃 Pro 用户（`planId !== 'free' && status === 'active' && !cancelAtPeriodEnd`）→ 400 `ALREADY_SUBSCRIBED`
- 已取消但未到期的用户（`cancelAtPeriodEnd === true`）→ 允许重新 checkout
- `past_due` 用户 → 允许重新 checkout（Stripe 会处理旧订阅）
- 无效 planId/interval → 400 `INVALID_INPUT`
- Stripe API 错误 → 502 `UPSTREAM_ERROR`

### 4. `POST /api/billing/portal-session`

**Auth**: 需要 JWT

**逻辑**:
1. 查询用户的 `stripeCustomerId`
2. 如果没有 → 400 错误（从未付过费的用户不应调用此端点）
3. 调用 `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: FRONTEND_URL + '/pricing' })`
4. 返回 `{ url: session.url }`

### 5. `POST /api/billing/webhook`

**Auth**: 公开（无 JWT），但需 Stripe 签名验证

**逻辑**:
1. 从 `stripe-signature` header 和 raw body 验签：`stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)`
2. 验签失败 → 400
3. 根据事件类型处理：

| Stripe 事件 | 处理 |
|-------------|------|
| `checkout.session.completed` | 从 session metadata 获取 `userId`，查询 Stripe Subscription 详情，upsert 数据库（by `userId`）：planId、status、billingInterval、stripeSubscriptionId、currentPeriodStart/End |
| `customer.subscription.updated` | 通过 `stripeCustomerId` 查找用户，upsert by `userId`：同步 status、cancelAtPeriodEnd、currentPeriodEnd、planId |
| `customer.subscription.deleted` | 通过 `stripeCustomerId` 查找用户，update by `userId`：planId = 'free'，status = 'canceled' |
| `invoice.payment_failed` | 通过 `stripeCustomerId` 查找用户，update by `userId`：status = 'past_due' |

**Webhook 幂等策略**: 所有 upsert/update 操作以 `userId`（`@unique`）为主键，非 `stripeSubscriptionId`。这避免了事件乱序或 deleted 后的 updated 事件导致的查找失败。`stripeCustomerId` → `userId` 的查找通过 Subscription 表的 `stripeCustomerId` 索引完成。

4. 所有事件返回 `200 { received: true }`
5. 未识别的事件类型直接返回 200（不处理）

**Price → PlanId 映射**:
从环境变量 `STRIPE_PRICE_PRO_MONTHLY` 和 `STRIPE_PRICE_PRO_YEARLY` 反向查找。如果 price ID 匹配这两个中任一 → `planId = 'pro'`。

## 服务层

### `BillingService` class

```
src/services/billing.service.ts
```

封装所有 billing 逻辑：

```typescript
class BillingService {
  // 查询
  getSubscription(userId: string): Promise<SubscriptionResponse>
  getUsage(userId: string): Promise<UsageResponse>

  // Checkout & Portal
  createCheckoutSession(userId: string, email: string, planId: string, interval: string): Promise<{ url: string }>
  createPortalSession(userId: string): Promise<{ url: string }>

  // Webhook 处理
  handleWebhookEvent(event: Stripe.Event): Promise<void>

  // 内部方法
  private getOrCreateCustomer(userId: string, email: string): Promise<string>
  private syncSubscriptionFromStripe(stripeSubscription: Stripe.Subscription, userId: string): Promise<void>
  private getPlanIdFromPriceId(priceId: string): string
  private getPlanLimits(planId: string): PlanLimits
}
```

### Stripe Client 初始化

```
src/lib/stripe.ts
```

```typescript
import Stripe from 'stripe';
import { config } from '../config';

export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2025-12-18.acacia',  // 锁定 API 版本
});
```

## 路由文件

```
src/routes/billing.ts
```

遵循现有路由模式：`Hono<AuthEnv>` + `c.get('user')` + 统一错误信封。

**Webhook 的特殊处理**:
- Webhook 需要 raw body（非 JSON parsed），Stripe 验签要求原始字符串
- 在 webhook 路由中手动读取 `await c.req.text()` 而非 `c.req.json()`
- Webhook 路径 `/api/billing/webhook` 添加到 `PUBLIC_PATHS` 数组

## 环境变量

新增到 `src/config/index.ts` 和 `env.example`：

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx

# Frontend URL (for Checkout redirect)
FRONTEND_URL=http://localhost:12323
```

**Config 验证**: 在 `src/config/index.ts` 中添加：
```typescript
stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
stripePriceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
stripePriceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || '',
frontendUrl: process.env.FRONTEND_URL || 'http://localhost:12323',
```

生产环境启动时校验：`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_PRO_MONTHLY`、`STRIPE_PRICE_PRO_YEARLY`、`FRONTEND_URL` 不能为空。

## Auth 中间件修改

在 `src/middleware/auth.ts` 的 `PUBLIC_PATHS` 数组中添加：

```typescript
'/api/billing/webhook',
```

## App 注册

在 `src/app.ts` 中注册 billing 路由：

```typescript
import { billing } from './routes/billing';
app.route('/', billing);
```

## Plan Limit 强制执行

不创建独立中间件。在现有 service 中添加检查：

- `ProjectService.createProject()` → 检查项目数量限额
- 后续可在 `CharacterService`、AI 生成等地方添加类似检查
- 超限 throw `AppException('PLAN_LIMIT_EXCEEDED', '已达到免费版项目数量上限', { statusCode: 403 })`

**ErrorCode 扩展**: 在 `src/lib/errors.ts` 的 `ErrorCode` enum 和 `ERROR_STATUS_MAP` 中新增：
```typescript
ALREADY_SUBSCRIBED = 'ALREADY_SUBSCRIBED',   // 400
UPSTREAM_ERROR = 'UPSTREAM_ERROR',           // 502
PLAN_LIMIT_EXCEEDED = 'PLAN_LIMIT_EXCEEDED', // 403
NO_STRIPE_CUSTOMER = 'NO_STRIPE_CUSTOMER',   // 400
```

## 文件清单

### 新增文件

```
src/lib/stripe.ts                  # Stripe client 单例
src/services/billing.service.ts    # Billing 业务逻辑
src/routes/billing.ts              # Billing API 路由（5个端点）
```

### 修改文件

```
src/db/schema.prisma               # 新增 Subscription 模型，User 加 relation
src/config/index.ts                # 新增 Stripe 相关配置 + 启动校验
src/lib/errors.ts                  # 新增 ErrorCode: ALREADY_SUBSCRIBED, UPSTREAM_ERROR, PLAN_LIMIT_EXCEEDED, NO_STRIPE_CUSTOMER
src/middleware/auth.ts             # PUBLIC_PATHS 添加 webhook
src/app.ts                        # 注册 billing 路由
env.example                       # 新增 Stripe 环境变量
src/services/project.service.ts   # createProject 加 plan limit 检查
```

### 新增依赖

```bash
npm install stripe
```

## 测试策略

- **单元测试**: BillingService 方法（mock Stripe SDK + Prisma）
- **集成测试**: Webhook 签名验证、事件处理
- **手动测试**: Stripe Test Mode + Stripe CLI（`stripe listen --forward-to localhost:12321/api/billing/webhook`）

## 边界情况

| 场景 | 处理 |
|------|------|
| 重复 Webhook 事件 | Prisma upsert by `userId`（`@unique`），幂等 |
| Webhook 先于 checkout-session 响应 | 数据库以 Webhook 为准，前端轮询 |
| 用户删除账户 | Subscription cascade delete，Stripe Customer 保留（Stripe 自动处理） |
| Stripe API 不可用 | checkout/portal 返回 502 UPSTREAM_ERROR |
| 无效签名的 Webhook | 返回 400，不处理 |
| Free 用户调用 portal | 返回 400 NO_STRIPE_CUSTOMER |
