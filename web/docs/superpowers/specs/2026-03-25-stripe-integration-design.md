# Stripe 订阅集成设计 — 前端部分

**日期**: 2026-03-25
**状态**: Approved
**项目**: Dramo.ai (AI 直播台本生成助手)

## 概述

为 Dramo.ai 接入 Stripe 订阅制收费。采用后端集中式方案：所有 Stripe API 调用和 Webhook 处理由 Fastify 后端（:12321）负责，前端（Next.js :12323）通过现有代理模式 `proxyRequest` 调用后端 billing API，只负责 UI 展示和跳转。

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 收费模式 | 订阅制（月/年付） | 符合 SaaS 标准模式，现有定价页已按此设计 |
| 支付方式 | 先 Stripe 国际卡，后续扩展 | 快速上线，后续可加微信/支付宝 |
| Checkout 体验 | Stripe Checkout 托管页面 | 开发量最小，安全合规由 Stripe 负责 |
| 订阅管理 | Stripe Customer Portal | 无需自建管理 UI，功能完善 |
| 后端职责 | Fastify 集中处理所有 Stripe 逻辑 | 符合现有代理架构，Secret Key 仅在后端 |
| 免费层 | 无需绑卡 | 降低注册门槛，升级时再跳转 Stripe |

## 架构

### 核心数据流

```
购买流程:
  用户点击「升级」
  → 前端 POST /api/billing/checkout
  → proxyRequest → 后端 POST /billing/checkout-session
  → 后端调用 Stripe API 创建 Checkout Session
  → 返回 session.url → 前端 redirect 到 Stripe Checkout 页面
  → 用户完成支付
  → Stripe Webhook → 后端 POST /billing/webhook
  → 后端更新数据库订阅状态
  → 前端 /billing/success 页面轮询确认激活

管理流程:
  用户点击「管理订阅」
  → 前端 POST /api/billing/portal
  → proxyRequest → 后端创建 Portal Session
  → 返回 portal.url → 前端 redirect 到 Stripe Customer Portal
```

### 职责边界

- **前端 (Next.js)**: UI 展示、跳转、软权限检查（Feature Gate 提示）
- **后端 (Fastify)**: Stripe API 调用、Webhook 处理、订阅状态持久化、硬权限检查（拒绝请求）
- **Stripe**: 支付页面托管、订阅生命周期管理、Customer Portal

## 数据模型

### 订阅类型 (`lib/models.ts` 扩展)

```typescript
type PlanId = 'free' | 'pro' | 'enterprise';
type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'unpaid' | 'incomplete' | 'incomplete_expired';
type BillingInterval = 'month' | 'year';

interface Subscription {
  planId: PlanId;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;  // null for free plan
  currentPeriodEnd: string | null;          // ISO 8601 date
  cancelAtPeriodEnd: boolean;               // 用户已请求取消但未到期
}
```

### Session 扩展 (`next-auth.d.ts`)

在 JWT 中只存 `planId`（轻量），完整订阅信息通过 API 按需获取：

```typescript
interface Session {
  // ...现有字段 (id, email, name, backendToken)
  planId: PlanId;  // 从后端 token 解析或登录时获取
}
```

### Session 刷新策略

JWT 中的 `planId` 不会在支付完成后自动更新。需要显式刷新：

1. **支付成功页**: 轮询 `getSubscription()` 确认激活后，调用 NextAuth `update()` 方法（`next-auth/react`）触发 JWT callback 重新从后端获取最新 `planId`
2. **useSubscription hook**: 当检测到 `subscription.planId !== session.planId` 时，自动调用 `update()` 刷新 Session
3. **JWT callback**: 在 NextAuth 的 `jwt` callback 中，当 `trigger === 'update'` 时，从后端 `/billing/subscription` 获取最新 `planId` 写入 token

## 前端 API 层

### API 函数 (`lib/api/billing.ts` 新文件)

```typescript
// 创建 Checkout Session，返回 Stripe 跳转 URL
createCheckoutSession(planId: PlanId, interval: BillingInterval): Promise<{ url: string }>

// 创建 Customer Portal Session，返回 Portal 跳转 URL
createPortalSession(): Promise<{ url: string }>

// 获取当前用户的订阅状态
getSubscription(): Promise<Subscription>

// 获取当前用量（AI 生成次数等）
getUsage(): Promise<Usage>
```

```typescript
// lib/models.ts 新增
interface Usage {
  aiGenerations: { used: number; limit: number | null; resetsAt: string | null };
  projects: { used: number; limit: number | null };
  characters: { used: number; limit: number | null };
}
```

### API Routes (代理到后端)

| 前端路由 | 后端路由 | 方法 | 说明 |
|---------|---------|------|------|
| `/api/billing/checkout` | `/billing/checkout-session` | POST | 创建 Checkout Session |
| `/api/billing/portal` | `/billing/portal-session` | POST | 创建 Portal Session |
| `/api/billing/subscription` | `/billing/subscription` | GET | 查询当前订阅状态 |
| `/api/billing/usage` | `/billing/usage` | GET | 查询当前用量 |

Webhook 不走前端代理，由后端直接暴露 `POST /billing/webhook` 接收 Stripe 回调。

### 自定义 Hooks

**`lib/hooks/use-subscription.ts`**

```typescript
function useSubscription(): {
  subscription: Subscription | null;
  isLoading: boolean;
  isPro: boolean;
  isFree: boolean;
  refresh: () => void;
}
```

- 内部缓存避免重复请求
- 窗口 focus 时自动 refresh（处理多标签页场景）
- 当 `subscription.planId !== session.planId` 时自动调用 `update()` 刷新 Session
- 在需要检查权限的组件中使用

**`lib/hooks/use-feature-gate.ts`**

```typescript
function useFeatureGate(featureKey: string): {
  allowed: boolean;
  reason: 'plan_required' | 'limit_reached' | null;
  currentUsage: number | null;
  limit: number | null;
  showUpgrade: () => void;  // 触发 UpgradeDialog
}
```

- 组合 `useSubscription` + `getUsage()` 数据
- 对于计划级 gate（如 `script:branching`），仅检查 `planId`
- 对于用量级 gate（如 `project:create`），从 Usage 数据获取当前计数与限额比较
- `showUpgrade()` 便捷方法触发全局 UpgradeDialog

## 页面与组件

### 改造: 定价页 (`app/pricing/page.tsx`)

现有定价页只有纯 UI，改造为：
- 根据登录状态和当前计划展示不同 CTA
  - 未登录: 「升级」→ 保存 planId 到 URL 参数 → 跳转登录 → 登录后自动进入 Checkout
  - 已登录 Free: 「升级 Pro」→ 调用 `createCheckoutSession` → redirect
  - 已登录 Pro: 显示「✓ 当前计划」+ 「管理订阅」
- 月付/年付切换（年付显示折扣，如省 17%）
- Stripe Checkout Session 的 `success_url` 和 `cancel_url` 指向前端回调页

### 新增: 支付回调页

- `app/billing/success/page.tsx` — 支付成功确认页
  - 显示成功信息 + 「返回项目」按钮
  - 轮询 `getSubscription()` 确认订阅激活（每 2s 一次，最多 15 次 = 30s）
  - 轮询成功后调用 `update()` 刷新 Session
  - 超时显示「正在处理中」+ 手动「再次检查」按钮
- `app/billing/cancel/page.tsx` — 支付取消页
  - 「返回项目」+ 「重新选择计划」按钮

### 新增: Billing 组件 (`components/billing/`)

- **SubscriptionCard** — 订阅状态卡片（嵌入用户设置页）
  - 当前计划、状态徽章、续费日期、「管理订阅」按钮
- **UpgradePrompt** — 内联升级提示
  - 🔒 锁定图标 + 功能描述 + 「升级 Pro」按钮
- **UpgradeDialog** — 升级对话框
  - 用户执行付费操作时弹出，列出 Pro 功能 + CTA
- **PastDueBanner** — 续费失败顶部 banner
  - 在 `subscription.status === 'past_due'` 时全局显示
  - 「支付失败，请更新支付方式」→ 跳转 Portal
  - 渲染在根 layout 中，主内容区域上方

### SubscriptionProvider (`app/providers.tsx`)

在 `app/providers.tsx` 中添加 `SubscriptionProvider` 包裹应用，提供：
- 全局订阅状态（避免每个组件独立请求）
- `PastDueBanner` 的渲染位置
- `UpgradeDialog` 的全局实例（通过 `showUpgrade()` 触发）
- 对后端 `PLAN_LIMIT_EXCEEDED` 错误的全局拦截：在 `lib/api/client.ts` 的 `api<T>()` 函数中，检测到该错误码时自动触发 UpgradeDialog

## Feature Gate 策略

### 计划功能划分

| 功能 | Free | Pro |
|------|------|-----|
| 项目数量 | 1 个 | 无限 |
| 剧本编辑模式 | 线性模式 | 线性 + 分支 + 故事板 |
| 角色管理 | 5 个 | 无限 |
| AI 生成 | N 次/天 | 无限 |
| 导出格式 | TXT | TXT + DOCX + PDF |
| AI 聊天助手 | ❌ | ✅ |

### 双层权限检查

1. **前端软 gate**: `useSubscription()` 检查 `planId`，不满足时显示 UpgradePrompt 或 UpgradeDialog。用户体验友好，但可被绕过。
2. **后端硬 gate**: 后端 API 在执行操作前检查用户订阅状态，不满足时返回 `403 { error: { code: 'PLAN_LIMIT_EXCEEDED' } }`。作为安全保障。

### Feature Gate 配置

```typescript
// lib/billing/feature-gates.ts
const FEATURE_GATES: Record<string, { requiredPlan: PlanId; limit?: number }> = {
  'project:create': { requiredPlan: 'free', limit: 1 },        // free 限 1 个
  'script:branching': { requiredPlan: 'pro' },
  'script:storyboard': { requiredPlan: 'pro' },
  'character:create': { requiredPlan: 'free', limit: 5 },      // free 限 5 个
  'ai:generate': { requiredPlan: 'free', limit: undefined },    // 具体限额由后端控制
  'export:docx': { requiredPlan: 'pro' },
  'export:pdf': { requiredPlan: 'pro' },
  'ai:chat': { requiredPlan: 'pro' },
};
```

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 创建 Checkout Session 失败 | toast 错误提示 + 重试按钮 |
| Webhook 延迟 | success 页轮询订阅状态（最多 30s），超时提示「正在处理中」|
| 订阅过期 (past_due) | 全局顶部 banner 提示 + 跳转 Portal 更新支付方式 |
| 取消但未到期 | 显示「Pro 计划将于 X 日到期」+ 「恢复订阅」按钮（跳转 Stripe Customer Portal）|
| 未登录用户点升级 | 保存 planId 到 URL 参数 → 登录 → 登录后自动跳转 Checkout |
| 多标签页并发 | useSubscription 在 window focus 时自动 refresh |
| 后端不可用 | API 代理返回统一错误信封，前端 toast 提示「服务暂时不可用」|
| PLAN_LIMIT_EXCEEDED | `api<T>()` 全局拦截 403 + 该错误码，自动触发 UpgradeDialog |
| Checkout 按钮防重复点击 | CTA 按钮在 async 操作期间显示 loading spinner 并 disabled |

## 环境变量 (前端新增)

Stripe Checkout 托管方式不需要前端 Stripe SDK，因此无需 `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`。无需安装 `@stripe/stripe-js` 包。

Stripe Secret Key (`STRIPE_SECRET_KEY`) 和 Webhook Secret (`STRIPE_WEBHOOK_SECRET`) 只在 Fastify 后端配置，前端不接触。

## 文件清单

### 新增文件

```
lib/api/billing.ts                    # Billing API 函数
lib/hooks/use-subscription.ts         # 订阅状态 Hook
lib/hooks/use-feature-gate.ts         # Feature Gate Hook
lib/billing/feature-gates.ts          # Feature Gate 配置
app/api/billing/checkout/route.ts     # 代理: Checkout Session
app/api/billing/portal/route.ts       # 代理: Portal Session
app/api/billing/subscription/route.ts # 代理: 订阅状态查询
app/api/billing/usage/route.ts        # 代理: 用量查询
app/billing/success/page.tsx          # 支付成功页
app/billing/cancel/page.tsx           # 支付取消页
components/billing/SubscriptionCard.tsx
components/billing/UpgradePrompt.tsx
components/billing/UpgradeDialog.tsx
components/billing/PastDueBanner.tsx
components/billing/index.ts           # Barrel export
mock/handlers/billing.ts              # MSW mock handlers (开发用)
```

### 修改文件

```
lib/models.ts                         # 新增 Subscription, Usage 类型
next-auth.d.ts                        # Session 扩展 planId
app/pricing/page.tsx                  # 接入真实 Stripe Checkout
app/providers.tsx                     # 添加 SubscriptionProvider
lib/api/client.ts                     # 添加 PLAN_LIMIT_EXCEEDED 全局拦截
```

## 测试策略

- **单元测试**: Feature Gate 配置逻辑、useSubscription hook（mock API）
- **集成测试**: API Route 代理正确性（mock 后端响应）
- **手动测试**: Stripe Test Mode 完整支付流程（使用 test card `4242 4242 4242 4242`）

## 后续扩展

1. 国内支付方式（微信/支付宝）— 后端扩展，前端增加支付方式选择
2. Stripe Elements 嵌入式表单 — 替代 Checkout 托管页面，提升体验
3. 用量计量面板 — 展示 AI 生成次数、存储使用等
4. 团队/组织计费 — Enterprise 计划的多席位管理
