# Dramo 错误诊断 - 快速参考

## 问题
用户点击"创建故事板"时收到"服务器内部错误"

## 系统状态检查结果

| 服务 | 端口 | 状态 | 备注 |
|------|------|------|------|
| Hono API | 12321 | ✅ 运行 | 需要 JWT 认证 (返回 401) |
| AgentOS | 12322 | ✅ 运行 | 正常工作 (返回 200) |
| Next.js 前端 | 12323 | ✅ 运行 | 已连接 |
| 数据库 | Supabase | ✅ 配置 | PostgreSQL |

## 根本原因

**前端向后端发送请求时缺少有效的 JWT Bearer Token**

### 诊断链条

```
用户点击"创建故事板"
  ↓
前端调用: POST /api/projects/{id}/storyboard/import
  ↓
Next.js 代理检查 NextAuth session
  ├─ ✅ 若有 backendToken → 添加 Authorization: Bearer {token}
  └─ ❌ 若无 backendToken → 返回 401 "未认证"
  ↓
后端 API 验证 Authorization 头
  ├─ ✅ 有效 token → 继续处理
  └─ ❌ 无效/缺失 → 返回 401 "未提供有效的认证凭据"
```

## 最可能的原因 (按概率排序)

1. **NextAuth session 中缺少 backendToken** (70%)
   - 登录成功但 token 未保存
   - 或 NextAuth 回调未正确配置

2. **JWT_SECRET 前后端不匹配** (15%)
   - 但目前检查显示配置一致

3. **Token 已过期** (10%)
   - JWT_EXPIRES_IN=30d

4. **登录端点返回异常** (5%)
   - /api/auth/login 可能失败

## 快速诊断步骤

### 步骤 1: 检查前端 Session

打开浏览器控制台 (F12) 并运行:
```javascript
fetch('http://localhost:12323/api/auth/session', {
  credentials: 'include'
})
.then(r => r.json())
.then(s => {
  console.log('Session:', s);
  console.log('Has BackendToken:', !!s.backendToken);
});
```

**预期**: `Has BackendToken: true`
**实际**: 可能显示 `false` ← 这就是问题所在

### 步骤 2: 检查登录是否工作

```bash
curl -X POST http://localhost:12321/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

**预期**: 返回包含 token 的响应

### 步骤 3: 查看浏览器网络请求

1. F12 → Network 标签
2. 点击"创建故事板"
3. 查看失败的请求
4. 检查 Request Headers 中是否有 `Authorization: Bearer ...`

### 步骤 4: 重启服务

```bash
# 清理旧进程
pkill -f "uvicorn"
pkill -f "tsx watch"

# 重新启动
npm run dev
```

## 关键文件位置

| 文件 | 作用 | 问题诊断 |
|------|------|--------|
| `/web/app/api/_utils/proxy.ts` | 前端代理层 | 第 170-182 行：检查 session.backendToken |
| `/server/src/middleware/auth.ts` | 后端认证 | 第 37-107 行：JWT 验证逻辑 |
| `/server/src/routes/storyboard.ts` | 故事板 API | 第 111-142 行：创建故事板端点 |
| `/web/app/api/projects/.../storyboard/import/route.ts` | Next.js API Route | 代理到后端 |

## 环境配置

**调试环境** (`.env.debug`)
```
JWT_SECRET=dev-secret-change-me
NEXTAUTH_SECRET=50fd9ebf51c7b4edc4f37120f255bc467a9cb8904396ae7c000167d447cdaf74
NEXT_PUBLIC_API_URL=http://localhost:12321
```

✅ 配置正确

## 系统架构简图

```
Browser
  ↓ HTTP
Next.js 12323
  ├─ UI 层: 故事板页面
  └─ API 层: 代理 + 认证
      ↓ + Bearer Token
Hono 12321
  ├─ 验证 JWT
  ├─ 查询数据库
  └─ 调用 AgentOS
      ↓ HTTP
AgentOS 12322
  ├─ 解析剧本
  └─ 调用 LLM
```

## 预期修复流程

1. **验证** NextAuth 配置中的登录回调是否正确设置 token
2. **修复** `/api/auth/login` 返回值或 NextAuth 会话处理
3. **测试** 登录流程 → 验证 session 中有 backendToken
4. **确认** 故事板导入工作正常

## 需要帮助?

完整诊断报告: `/Users/halyu/Documents/Code/dramo/DIAGNOSTICS.md`

执行上述诊断步骤并提供输出，我会帮助进一步定位问题。
