# Release部署指南

本指南详细说明如何将项目从开发模式切换到生产模式(Release)。

## 📋 准备工作

### 1. 环境要求
- **生产环境服务器**
- **域名和SSL证书**
- **Supabase项目** (数据库和认证)
- **生产环境的API密钥** (OpenAI等)
- **生产环境Redis**
- **Docker环境** (用于容器化部署)

### 2. 所需配置信息
确保你拥有以下生产环境配置：
- Supabase项目URL和数据库密码
- OpenAI API密钥
- Redis连接地址
- 域名和SSL证书
- AgentOS服务地址

## 🚀 开发模式 → Release模式切换步骤

### 步骤1: 后端配置

#### 1.1 创建生产环境配置文件
```bash
# 复制环境模板
cp env.example .env.production

# 编辑生产配置
nano .env.production
```

#### 1.2 关键配置项修改
```bash
# =================================
# SERVER CONFIGURATION
# =================================
NODE_ENV=production
PORT=12321
LOG_LEVEL=warn  # 生产环境使用warn级别

# =================================
# DATABASE CONFIGURATION  
# =================================
DATABASE_URL=postgresql://postgres:[YOUR_PROD_PASSWORD]@db.[YOUR_PROJECT].supabase.co:5432/postgres

# =================================
# CACHE & QUEUE CONFIGURATION
# =================================
REDIS_URL=redis://[your-redis-host]:6379

# =================================
# AUTHENTICATION & SECURITY
# =================================
JWT_SECRET=[YOUR_SECURE_RANDOM_SECRET_KEY]

# =================================
# USER ID MANAGEMENT (Production)
# =================================
# 生产环境应该禁用测试用户ID系统
DEV_TEST_USER_ID=  # 清空或留空

# =================================
# AI SERVICE CONFIGURATION
# =================================
AGENTOS_BASE_URL=[YOUR_AGENTOS_PROD_URL]
AGENTOS_SECURITY_KEY=[YOUR_AGENTOS_TOKEN]

# =================================
# STORAGE CONFIGURATION
# =================================
STORAGE_DRIVER=supabase
SUPABASE_URL=[YOUR_SUPABASE_URL]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SUPABASE_SERVICE_KEY]
SUPABASE_BUCKET=images

# =================================
# API KEYS & PROVIDERS
# =================================
OPENAI_API_KEY=[YOUR_OPENAI_API_KEY]

# =================================
# WORKER CONFIGURATION
# =================================
WORKER_CONCURRENCY=10  # 生产环境增加并发数

# =================================
# RATE LIMITING
# =================================
RATE_LIMIT_GLOBAL=50  # 生产环境启用严格限流
RATE_LIMIT_WINDOW=60

# =================================
# TELEMETRY & MONITORING
# =================================
OTEL_ENABLED=true  # 生产环境启用监控
OTEL_EXPORTER_OTLP_ENDPOINT=[YOUR_OTEL_ENDPOINT]
```

### 步骤2: 前端配置

#### 2.1 创建生产环境配置
```bash
cd story_agent_front

# 复制环境模板
cp .env.example .env.production

# 编辑生产配置
nano .env.production
```

#### 2.2 前端生产配置
```bash
# =================================
# API CONFIGURATION
# =================================
# 生产环境API地址
NEXT_PUBLIC_API_URL=https://your-api-domain.com

# =================================
# USER ID MANAGEMENT (Production)
# =================================
# 生产环境禁用测试用户ID
NEXT_PUBLIC_TEST_USER_ID=

# =================================
# STORAGE CONFIGURATION
# =================================
NEXT_PUBLIC_STORAGE_BASE_URL=https://your-supabase-project.supabase.co/storage/v1/object/public/images

# =================================
# PRODUCTION SETTINGS
# =================================
NEXT_PUBLIC_ENABLE_DEV_FEATURES=false
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_ENABLE_SSE=true
NEXT_PUBLIC_ENABLE_WEBSOCKETS=true
```

### 步骤3: 代码修改

#### 3.1 禁用开发模式功能
修改 `src/config/index.ts`，确保生产环境配置：

```typescript
export const config = {
  // 确保生产环境配置
  nodeEnv: process.env.NODE_ENV || 'production',
  isDev: process.env.NODE_ENV !== 'production', // false in production
  
  // 其他配置...
};
```

#### 3.2 禁用测试用户系统
在 `src/lib/user-identity/config.ts` 中添加生产环境检查：

```typescript
export function getUserConfig(): UserConfig {
  const isDev = config.isDev;
  const envTestUserId = process.env.DEV_TEST_USER_ID;
  
  // 生产环境禁用测试用户
  if (!isDev && envTestUserId) {
    throw new Error('Test users are not allowed in production environment');
  }
  
  return {
    isDevelopment: isDev,
    testUserId: envTestUserId || 'test-user-dev-001', // 生产环境不会用到
    allowMockAuth: isDev,
    requireRealAuth: !isDev,
    // 其他配置...
  };
}
```

#### 3.3 强化认证
在 `src/api/middleware/auth.ts` 中确保生产环境必须提供有效JWT：

```typescript
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // 生产环境严格要求认证
  if (!config.isDev) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: {
          code: 'UNAUTHORIZED',
          message: '生产环境需要有效认证',
        },
      });
    }
  }
  
  // 其他认证逻辑...
}
```

### 步骤4: Docker配置

#### 4.1 更新Docker Compose
在生产环境中使用环境变量文件：

```bash
# 在生产服务器上
docker-compose --env-file .env.production up -d
```

#### 4.2 优化Docker配置
确保Docker Compose使用生产环境配置：

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    env_file:
      - .env.production  # 使用生产环境配置
    environment:
      - NODE_ENV=production
    
  # 其他服务...
```

### 步骤5: SSL和域名配置

#### 5.1 配置Nginx反向代理 (如果使用)
创建nginx配置文件：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API请求
    location /api/ {
        proxy_pass http://localhost:12321;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔧 部署命令

### 开发环境启动
```bash
# 后端
cd story_agent
docker-compose up -d

# 前端
cd story_agent_front  
npm run dev
```

### 生产环境部署
```bash
# 后端
cd story_agent
docker-compose --env-file .env.production up -d

# 前端
cd story_agent_front
npm run build
npm start
```

## 📊 环境对比表

| 配置项 | 开发模式 | 生产模式 |
|--------|----------|----------|
| NODE_ENV | development | production |
| 认证方式 | 简化认证 | 完整JWT验证 |
| 用户ID | 测试用户 | 真实用户系统 |
| 日志级别 | info | warn |
| 限流设置 | 宽松 | 严格 |
| 存储 | 本地 | Supabase |
| 监控 | 关闭 | 开启 |
| 错误显示 | 详细 | 隐藏 |

## ⚠️ 重要注意事项

1. **安全性**:
   - 更换所有密钥和密码
   - 禁用开发模式功能
   - 启用完整的认证机制

2. **性能优化**:
   - 启用生产模式代码优化
   - 配置合适的缓存策略
   - 调整worker并发数

3. **监控**:
   - 启用错误监控
   - 配置健康检查
   - 设置日志聚合

4. **备份**:
   - 定期备份数据库
   - 备份用户生成的内容
   - 保存配置文档

## 🔄 回滚到开发模式

如需临时回滚到开发模式：

1. **恢复环境变量**:
   ```bash
   # 后端
   docker-compose restart api
   
   # 前端
   npm run dev
   ```

2. **重新启用测试功能**:
   - 在.env中添加`DEV_TEST_USER_ID`
   - 禁用生产环境限制

## 📞 技术支持

如遇到部署问题，请检查：
- 环境变量配置是否正确
- 数据库连接是否正常
- 网络和端口配置
- SSL证书配置
