# 认证系统迁移指南

## 概述

项目已从自定义的 localStorage + Cookie 认证迁移到 NextAuth.js，实现了前后端统一的认证体系。

## 主要变更

### 前端变更

1. **NextAuth 集成**
   - 新增 `lib/auth/options.ts` - NextAuth 配置
   - 新增 `app/api/auth/[...nextauth]/route.ts` - NextAuth API 路由
   - 新增 `app/providers.tsx` - SessionProvider 包装器
   - 新增 `next-auth.d.ts` - TypeScript 类型扩展

2. **认证流程**
   - 登录/注册页面使用 `signIn()` 和 `signOut()` 函数
   - 组件中使用 `useSession()` hook 获取会话状态
   - 服务端使用 `getServerSession(authOptions)` 获取会话

3. **API 代理**
   - 新增 `app/api/_utils/proxy.ts` - 统一的 API 代理工具
   - 所有 API 路由自动从 NextAuth session 获取 `backendToken` 并添加到请求头

4. **移除的代码**
   - 删除 `lib/auth.ts` - 旧的 localStorage 认证工具
   - 删除 `app/api/auth/login/route.ts` 和 `app/api/auth/register/route.ts` - 旧的认证路由
   - 删除所有 `auth_token` Cookie 相关代码

### 后端变更

1. **认证中间件简化**
   - `src/api/middleware/auth.ts` 移除开发环境回退逻辑
   - 所有请求必须提供有效的 Bearer Token
   - 移除 `UserIdentityManager` 依赖

2. **路由更新**
   - `src/api/routes/auth.ts` - `/api/auth/me` 现在需要认证
   - `src/api/routes/generation-jobs.ts` - 任务路由统一使用认证用户 ID

3. **移除的代码**
   - 删除 `src/lib/user-identity/` - 用户 ID 管理器
   - 移除所有测试用户回退逻辑

## 环境变量配置

### 前端 (.env.local)

```bash
# NextAuth 配置
NEXTAUTH_SECRET=dev-secret-change-me
NEXTAUTH_URL=http://localhost:12323

# 后端 API URL
NEXT_PUBLIC_API_URL=http://localhost:12321
```

### 后端 (.env)

```bash
# JWT Secret（必须与前端 NEXTAUTH_SECRET 一致，或使用相同的密钥）
JWT_SECRET=dev-secret-change-me
```

## 使用方式

### 客户端组件

```tsx
"use client";
import { useSession, signIn, signOut } from "next-auth/react";

export function MyComponent() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>加载中...</div>;
  if (status === "unauthenticated") return <button onClick={() => signIn()}>登录</button>;

  return (
    <div>
      <p>欢迎, {session?.user?.email}</p>
      <button onClick={() => signOut()}>登出</button>
    </div>
  );
}
```

### 服务端组件/API 路由

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.backendToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 使用 session.backendToken 调用后端 API
  const response = await fetch("http://localhost:12321/api/...", {
    headers: {
      Authorization: `Bearer ${session.backendToken}`,
    },
  });

  return response;
}
```

### API 代理

```tsx
import { proxyRequest } from "@/app/api/_utils/proxy";

export async function GET(request: Request) {
  return proxyRequest(request, "/api/projects", {
    requireAuth: true, // 需要认证
  });
}
```

## 迁移检查清单

- [x] NextAuth 配置完成
- [x] 登录/注册页面更新
- [x] 所有组件迁移到 `useSession()`
- [x] API 路由使用 `proxyRequest` 或手动获取 session
- [x] 移除所有 `auth_token` 相关代码
- [x] 后端中间件更新
- [x] 环境变量配置更新
- [x] 文档更新

## 测试要点

1. **登录流程**
   - 访问 `/login` 页面
   - 输入邮箱和密码
   - 确认成功登录并跳转

2. **会话持久化**
   - 登录后刷新页面，确认会话保持
   - 检查浏览器 Cookie 中是否有 NextAuth session

3. **API 调用**
   - 确认所有受保护的 API 请求都包含 Authorization 头
   - 测试未登录时访问受保护 API 返回 401

4. **任务刷新**
   - 登录后触发图片生成、确认队列刷新正常
   - 未登录状态下访问 `/api/jobs` 应返回 401

## 常见问题

### Q: 登录后仍然显示未登录状态

A: 检查 `NEXTAUTH_SECRET` 和 `NEXTAUTH_URL` 是否正确配置，确保 `SessionProvider` 已正确包裹应用。

### Q: API 请求返回 401

A: 确认 `session.backendToken` 存在，检查后端 `JWT_SECRET` 是否与生成 token 时使用的密钥一致。

### Q: 清空 localStorage 后依然被立即重定向或提示凭证过期

A: NextAuth 的会话保存在 Cookie（`next-auth.session-token`、`next-auth.csrf-token` 等）里，而不是 localStorage。清除 localStorage 不会让会话失效，登录页仍会把状态视为已认证，并携带旧的 `backendToken` 调用后端。请在浏览器 DevTools → Application → Cookies 中删除 `next-auth.*` 条目，或直接调用 `signOut()`/访问 `/api/auth/signout` 来让 NextAuth 将状态置为 `unauthenticated`，然后再重新登录获取新 token。

### Q: 任务列表不刷新

A: 检查 `/api/jobs` 是否返回数据，必要时手动调用刷新函数或重新登录。

## 回滚方案

如果需要回滚到旧系统：

1. 恢复 `lib/auth.ts` 文件
2. 恢复旧的登录/注册 API 路由
3. 恢复组件中的 `isLoggedIn()` 调用
4. 恢复后端 `UserIdentityManager` 代码

但建议继续使用 NextAuth，因为它提供了更好的安全性和可维护性。

