# Dramo 腾讯云一键部署 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一键脚本将 Dramo 全栈部署到腾讯云 VPS（Docker Compose + Nginx 反向代理）

**Architecture:** 在现有 docker-compose.yml 基础上新增 Nginx 容器和 web 容器，统一通过 80 端口对外服务。一键脚本覆盖从裸机到服务可用的全流程：系统检测、Docker 安装、代码克隆、环境变量配置、构建启动、健康检查。

**Tech Stack:** Docker Compose, Nginx, Next.js standalone, Hono (Node.js), FastAPI (Python), Ubuntu/Debian

---

## File Structure

```
新增文件:
  deploy/setup-dramo.sh       — 一键部署主脚本
  deploy/update.sh            — 更新部署脚本
  deploy/logs.sh              — 日志查看脚本
  deploy/nginx.conf           — Nginx 反向代理配置
  deploy/.env.template        — 环境变量模板（带注释）
  web/Dockerfile              — Next.js standalone 构建

修改文件:
  docker-compose.yml          — 新增 nginx + web 服务，移除端口暴露
  web/next.config.ts          — 添加 output: "standalone"
```

---

### Task 1: Next.js standalone 输出配置

**Files:**
- Modify: `web/next.config.ts:3`

- [ ] **Step 1: 修改 next.config.ts 添加 standalone 输出**

在 `nextConfig` 对象中添加 `output: "standalone"`：

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
```

其余配置保持不变。

- [ ] **Step 2: 验证配置生效**

Run: `cd /Users/halyu/Documents/Code/dramo && npm run build -w @dramo/web 2>&1 | head -20`

Expected: 构建成功，输出中可以看到 standalone 相关信息。如果有错误提示 `output: "standalone"` 与 `experimental.externalDir` 冲突，需要移除 `externalDir: true`。

- [ ] **Step 3: Commit**

```bash
git add web/next.config.ts
git commit -m "feat: enable Next.js standalone output for Docker deployment"
```

---

### Task 2: web/Dockerfile

**Files:**
- Create: `web/Dockerfile`

- [ ] **Step 1: 创建 web/Dockerfile**

```dockerfile
# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are baked at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget --spider -q http://localhost:3000 || exit 1

CMD ["node", "server.js"]
```

- [ ] **Step 2: 创建 web/.dockerignore**

```
node_modules
.next
.env*
*.md
.git
```

- [ ] **Step 3: Commit**

```bash
git add web/Dockerfile web/.dockerignore
git commit -m "feat: add web Dockerfile for Next.js standalone deployment"
```

---

### Task 3: Nginx 配置

**Files:**
- Create: `deploy/nginx.conf`

- [ ] **Step 1: 创建 deploy 目录**

```bash
mkdir -p deploy
```

- [ ] **Step 2: 创建 deploy/nginx.conf**

```nginx
events {
    worker_connections 1024;
}

http {
    # 基础优化
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 1000;

    # 日志格式
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    upstream web_backend {
        server web:3000;
    }

    upstream api_backend {
        server api:12321;
    }

    server {
        listen 80;
        server_name _;

        # 后端 API + SSE（必须在 / 之前匹配）
        location /api/ {
            proxy_pass http://api_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # 长连接支持（分镜生成最长 9 分钟 + SSE 流式）
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;

            # SSE 必须关闭缓冲
            proxy_buffering off;
            proxy_cache off;
            proxy_set_header Connection "";
        }

        # 前端页面
        location / {
            proxy_pass http://web_backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # Next.js WebSocket (HMR)
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add deploy/nginx.conf
git commit -m "feat: add Nginx reverse proxy config for VPS deployment"
```

---

### Task 4: 改造 docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: 改造 docker-compose.yml**

完整的新版 `docker-compose.yml`：

```yaml
services:
  # Nginx Reverse Proxy (唯一对外暴露端口)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./deploy/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      web:
        condition: service_healthy
      api:
        condition: service_healthy
    restart: unless-stopped

  # Frontend (Next.js standalone)
  web:
    build:
      context: ./web
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost/api}
    environment:
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - BACKEND_API_URL=http://api:12321
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    restart: unless-stopped

  # AgentOS Service (Python AI)
  agentos:
    build: ./agentos
    environment:
      PORT: 12322
      LOG_LEVEL: ${LOG_LEVEL:-INFO}
      AI_PROVIDER: ${AI_PROVIDER:-openai}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENAI_API_BASE: ${OPENAI_API_BASE:-}
      OPENAI_MODEL_ID: ${OPENAI_MODEL_ID:-gpt-4-turbo-preview}
      HUNYUAN_OPENAPI_URL: ${HUNYUAN_OPENAPI_URL:-}
      HUNYUAN_OPENAPI_KEY: ${HUNYUAN_OPENAPI_KEY:-}
      HUNYUAN_MODEL_ID: ${HUNYUAN_MODEL_ID:-hunyuan-turbos-latest}
      ARK_API_KEY: ${ARK_API_KEY}
      AGENTOS_SECURITY_KEY: ${AGENTOS_SECURITY_KEY:-}
      LLM_TIMEOUT_LONG_SECONDS: ${LLM_TIMEOUT_LONG_SECONDS:-180}
      DETAIL_REFINER_TIMEOUT_SECONDS: ${DETAIL_REFINER_TIMEOUT_SECONDS:-200}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:12322/health')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

  # API Service (Hono)
  api:
    build: ./server
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      PORT: 12321
      LOG_LEVEL: ${LOG_LEVEL:-info}
      DATABASE_URL: ${DATABASE_URL}
      DIRECT_URL: ${DIRECT_URL:-}
      AGENTOS_BASE_URL: http://agentos:12322
      AGENTOS_SECURITY_KEY: ${AGENTOS_SECURITY_KEY:-}
      JWT_SECRET: ${JWT_SECRET}
      STORAGE_DRIVER: ${STORAGE_DRIVER:-supabase}
      STORAGE_LOCAL_DIR: /app/uploads
      STORAGE_BASE_URL: ${STORAGE_BASE_URL:-http://localhost:12321/uploads}
      SUPABASE_URL: ${SUPABASE_URL:-}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:-}
      SUPABASE_BUCKET: ${SUPABASE_BUCKET:-images}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
      STRIPE_PRICE_PRO_MONTHLY: ${STRIPE_PRICE_PRO_MONTHLY:-}
      STRIPE_PRICE_PRO_YEARLY: ${STRIPE_PRICE_PRO_YEARLY:-}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY:-}
      AI_PROVIDER: ${AI_PROVIDER:-openai}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      OPENAI_API_BASE: ${OPENAI_API_BASE:-}
      OPENAI_MODEL_ID: ${OPENAI_MODEL_ID:-}
    volumes:
      - api_uploads:/app/uploads
    depends_on:
      agentos:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:12321/api/health')"]
      interval: 30s
      timeout: 5s
      retries: 3

  # Optional: Local PostgreSQL (use profile localpg)
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-story_agent}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    profiles:
      - localpg

volumes:
  postgres_data:
  api_uploads:

networks:
  default:
    name: dramo-network
```

**关键改动说明：**
- 新增 `nginx` 服务，唯一暴露 80 端口
- 新增 `web` 服务，build arg 传入 `NEXT_PUBLIC_API_URL`
- `agentos` 移除 `ports: ["12322:12322"]`
- `api` 移除 `ports: ["12321:12321"]`
- `api` 的 `depends_on` 改为 `condition: service_healthy` 等待 agentos 就绪
- `api` 的 `NODE_ENV` 默认值改为 `production`

- [ ] **Step 2: 本地验证 compose 配置语法**

Run: `cd /Users/halyu/Documents/Code/dramo && docker compose config --quiet 2>&1`

Expected: 无报错输出。如果提示 `.env` 变量缺失，属正常（服务器上会有完整 .env）。

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add nginx + web containers, remove port exposure for VPS deploy"
```

---

### Task 5: 环境变量模板

**Files:**
- Create: `deploy/.env.template`

- [ ] **Step 1: 创建 deploy/.env.template**

```bash
# ============================================================
#  Dramo — 腾讯云 VPS 部署环境变量
#  由 setup-dramo.sh 自动生成，也可手动编辑
# ============================================================

# --- 服务器 (自动检测) ---
NODE_ENV=production
PORT=12321
LOG_LEVEL=info
SERVER_IP=__SERVER_IP__

# --- 访问地址 (自动推导) ---
NEXT_PUBLIC_API_URL=http://__SERVER_IP__/api
NEXTAUTH_URL=http://__SERVER_IP__
FRONTEND_URL=http://__SERVER_IP__

# --- 数据库 (必填) ---
DATABASE_URL=__DATABASE_URL__

# --- 认证密钥 (自动生成) ---
JWT_SECRET=__JWT_SECRET__
JWT_EXPIRES_IN=30d
ENCRYPTION_KEY=__ENCRYPTION_KEY__
NEXTAUTH_SECRET=__NEXTAUTH_SECRET__

# --- AgentOS 内部通信 (自动生成) ---
AGENTOS_BASE_URL=http://agentos:12322
AGENTOS_SECURITY_KEY=__AGENTOS_SECURITY_KEY__

# --- AI 配置 (必填) ---
AI_PROVIDER=openai
OPENAI_API_KEY=__OPENAI_API_KEY__
OPENAI_API_BASE=
OPENAI_MODEL_ID=

# --- 腾讯混元 (可选) ---
HUNYUAN_OPENAPI_KEY=
HUNYUAN_OPENAPI_URL=
HUNYUAN_MODEL_ID=hunyuan-turbos-latest

# --- 图片生成 (可选) ---
ARK_API_KEY=

# --- 存储 (必填 Supabase) ---
STORAGE_DRIVER=supabase
SUPABASE_URL=__SUPABASE_URL__
SUPABASE_SERVICE_ROLE_KEY=__SUPABASE_SERVICE_ROLE_KEY__
SUPABASE_BUCKET=images

# --- Stripe 付费 (可选，回车跳过) ---
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
```

- [ ] **Step 2: Commit**

```bash
git add deploy/.env.template
git commit -m "feat: add .env template for VPS deployment"
```

---

### Task 6: 一键部署脚本 setup-dramo.sh

**Files:**
- Create: `deploy/setup-dramo.sh`

- [ ] **Step 1: 创建 deploy/setup-dramo.sh**

```bash
#!/bin/bash
# ============================================================
#  Dramo — 腾讯云 VPS 一键部署脚本
#  用法: curl -fsSL <raw-url>/deploy/setup-dramo.sh | bash
#  或:   bash deploy/setup-dramo.sh
# ============================================================
set -euo pipefail

# --- 颜色 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

INSTALL_DIR="/opt/dramo"

# ===================== 辅助函数 =====================

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "\n${BOLD}${CYAN}>>> $*${NC}\n"; }

fail() { log_error "$*"; exit 1; }

prompt_required() {
    local var_name="$1"
    local prompt_text="$2"
    local value=""
    while [ -z "$value" ]; do
        read -rp "$(echo -e "${BOLD}$prompt_text${NC}: ")" value
        [ -z "$value" ] && log_warn "此项为必填，请输入"
    done
    eval "$var_name=\"$value\""
}

prompt_optional() {
    local var_name="$1"
    local prompt_text="$2"
    local value=""
    read -rp "$(echo -e "${BOLD}$prompt_text${NC} (回车跳过): ")" value
    eval "$var_name=\"$value\""
}

# ===================== Step 1: 系统检查 =====================

log_step "Step 1/7: 系统检查"

# 检测 OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="$ID"
    OS_VERSION="$VERSION_ID"
    log_info "操作系统: $PRETTY_NAME"
else
    fail "无法检测操作系统，仅支持 Ubuntu/Debian/CentOS"
fi

case "$OS_NAME" in
    ubuntu|debian|centos|rocky|almalinux)
        ;;
    *)
        log_warn "未测试的操作系统: $OS_NAME，可能会有兼容性问题"
        ;;
esac

# 检测资源
CPU_CORES=$(nproc)
MEM_MB=$(awk '/MemTotal/ {printf "%d", $2/1024}' /proc/meminfo)
log_info "CPU: ${CPU_CORES} 核, 内存: ${MEM_MB}MB"

if [ "$CPU_CORES" -lt 2 ]; then
    log_warn "CPU 少于 2 核，可能影响构建速度"
fi
if [ "$MEM_MB" -lt 3500 ]; then
    log_warn "内存少于 4GB，可能影响 Docker 构建"
fi

# 检测端口 80
if ss -tlnp | grep -q ':80 '; then
    log_warn "端口 80 已被占用，请先停止占用进程:"
    ss -tlnp | grep ':80 '
    fail "端口 80 被占用，请运行 'sudo lsof -i :80' 排查"
fi
log_info "端口 80 可用"

# ===================== Step 2: 安装依赖 =====================

log_step "Step 2/7: 安装 Docker & Git"

install_docker_debian() {
    if command -v docker &>/dev/null; then
        log_info "Docker 已安装: $(docker --version)"
        return
    fi
    log_info "安装 Docker Engine..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/$OS_NAME/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS_NAME $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log_info "Docker 安装完成: $(docker --version)"
}

install_docker_centos() {
    if command -v docker &>/dev/null; then
        log_info "Docker 已安装: $(docker --version)"
        return
    fi
    log_info "安装 Docker Engine..."
    yum install -y yum-utils
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    log_info "Docker 安装完成: $(docker --version)"
}

case "$OS_NAME" in
    ubuntu|debian) install_docker_debian ;;
    centos|rocky|almalinux) install_docker_centos ;;
    *) fail "不支持的操作系统，请手动安装 Docker: https://docs.docker.com/engine/install/" ;;
esac

# 验证 docker compose
if ! docker compose version &>/dev/null; then
    fail "Docker Compose v2 未安装，请参考: https://docs.docker.com/compose/install/"
fi
log_info "Docker Compose: $(docker compose version --short)"

# 安装 git
if ! command -v git &>/dev/null; then
    log_info "安装 git..."
    if command -v apt-get &>/dev/null; then
        apt-get install -y -qq git
    else
        yum install -y git
    fi
fi
log_info "Git: $(git --version)"

# ===================== Step 3: 克隆代码 =====================

log_step "Step 3/7: 克隆代码"

if [ -d "$INSTALL_DIR" ]; then
    log_warn "$INSTALL_DIR 已存在"
    read -rp "$(echo -e "${YELLOW}覆盖并重新克隆？ (y/N): ${NC}")" confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        rm -rf "$INSTALL_DIR"
    else
        log_info "跳过克隆，使用现有代码"
    fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
    REPO_URL=""
    prompt_required REPO_URL "Git 仓库地址 (HTTPS 或 SSH)"
    git clone "$REPO_URL" "$INSTALL_DIR"
    log_info "代码已克隆到 $INSTALL_DIR"
else
    log_info "使用现有代码: $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ===================== Step 4: 配置环境变量 =====================

log_step "Step 4/7: 配置环境变量"

# 检测公网 IP
SERVER_IP=$(curl -s --max-time 5 ifconfig.me || curl -s --max-time 5 ipinfo.io/ip || echo "")
if [ -z "$SERVER_IP" ]; then
    prompt_required SERVER_IP "无法自动检测公网 IP，请手动输入"
else
    log_info "检测到公网 IP: $SERVER_IP"
    read -rp "$(echo -e "使用此 IP？(Y/n): ")" confirm_ip
    if [ "$confirm_ip" = "n" ] || [ "$confirm_ip" = "N" ]; then
        prompt_required SERVER_IP "请输入公网 IP"
    fi
fi

# 自动生成密钥
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
AGENTOS_SECURITY_KEY=$(openssl rand -hex 16)
log_info "已自动生成 JWT_SECRET, ENCRYPTION_KEY, NEXTAUTH_SECRET, AGENTOS_SECURITY_KEY"

# 交互式输入
echo ""
echo -e "${BOLD}请输入以下必填配置：${NC}"
echo ""

DATABASE_URL=""
prompt_required DATABASE_URL "Supabase PostgreSQL 连接串 (postgresql://...)"

OPENAI_API_KEY=""
prompt_required OPENAI_API_KEY "OpenAI API Key (sk-...)"

SUPABASE_URL=""
prompt_required SUPABASE_URL "Supabase 项目 URL (https://xxx.supabase.co)"

SUPABASE_SERVICE_ROLE_KEY=""
prompt_required SUPABASE_SERVICE_ROLE_KEY "Supabase Service Role Key"

echo ""
echo -e "${BOLD}以下为可选配置（回车跳过）：${NC}"
echo ""

STRIPE_SECRET_KEY=""
prompt_optional STRIPE_SECRET_KEY "Stripe Secret Key"

STRIPE_WEBHOOK_SECRET=""
prompt_optional STRIPE_WEBHOOK_SECRET "Stripe Webhook Secret"

STRIPE_PRICE_PRO_MONTHLY=""
prompt_optional STRIPE_PRICE_PRO_MONTHLY "Stripe Pro 月付价格 ID"

STRIPE_PRICE_PRO_YEARLY=""
prompt_optional STRIPE_PRICE_PRO_YEARLY "Stripe Pro 年付价格 ID"

OPENAI_API_BASE=""
prompt_optional OPENAI_API_BASE "OpenAI API Base URL (自定义网关)"

# 写入 .env
cat > "$INSTALL_DIR/.env" << ENVEOF
# Dramo VPS 部署配置 — 由 setup-dramo.sh 自动生成
# 生成时间: $(date '+%Y-%m-%d %H:%M:%S')

NODE_ENV=production
PORT=12321
LOG_LEVEL=info

# 访问地址
NEXT_PUBLIC_API_URL=http://${SERVER_IP}/api
NEXTAUTH_URL=http://${SERVER_IP}
FRONTEND_URL=http://${SERVER_IP}

# 数据库
DATABASE_URL=${DATABASE_URL}

# 认证密钥
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=30d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# AgentOS
AGENTOS_BASE_URL=http://agentos:12322
AGENTOS_SECURITY_KEY=${AGENTOS_SECURITY_KEY}

# AI
AI_PROVIDER=openai
OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_API_BASE=${OPENAI_API_BASE}
OPENAI_MODEL_ID=

# 存储
STORAGE_DRIVER=supabase
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
SUPABASE_BUCKET=images

# Stripe
STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
STRIPE_PRICE_PRO_MONTHLY=${STRIPE_PRICE_PRO_MONTHLY}
STRIPE_PRICE_PRO_YEARLY=${STRIPE_PRICE_PRO_YEARLY}
ENVEOF

chmod 600 "$INSTALL_DIR/.env"
log_info ".env 已生成并设置权限 600"

# ===================== Step 5: 防火墙 =====================

log_step "Step 5/7: 配置防火墙"

if command -v ufw &>/dev/null; then
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw --force enable
    log_info "ufw 防火墙已配置: 仅开放 22 (SSH) + 80 (HTTP)"
elif command -v firewall-cmd &>/dev/null; then
    firewall-cmd --permanent --add-service=ssh
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
    log_info "firewalld 已配置: 仅开放 SSH + HTTP"
else
    log_warn "未检测到防火墙工具，请手动配置安全组仅开放 22 和 80 端口"
fi

# ===================== Step 6: 构建 & 启动 =====================

log_step "Step 6/7: 构建 & 启动服务"

log_info "开始构建 Docker 镜像（首次约 3-5 分钟）..."
docker compose build --parallel

log_info "启动所有服务..."
docker compose up -d

# ===================== Step 7: 健康检查 =====================

log_step "Step 7/7: 健康检查"

MAX_WAIT=90
INTERVAL=5
ELAPSED=0

check_health() {
    local name="$1"
    local url="$2"
    curl -sf --max-time 3 "$url" > /dev/null 2>&1
}

log_info "等待服务启动（最多 ${MAX_WAIT}s）..."

AGENTOS_OK=false
API_OK=false
WEB_OK=false

while [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))

    if ! $AGENTOS_OK && check_health "agentos" "http://localhost:12322/health"; then
        AGENTOS_OK=true
        log_info "AgentOS ✓ (${ELAPSED}s)"
    fi

    if ! $API_OK && check_health "api" "http://localhost:12321/api/health"; then
        API_OK=true
        log_info "API ✓ (${ELAPSED}s)"
    fi

    if ! $WEB_OK && check_health "web" "http://localhost:3000"; then
        WEB_OK=true
        log_info "Web ✓ (${ELAPSED}s)"
    fi

    if $AGENTOS_OK && $API_OK && $WEB_OK; then
        break
    fi
done

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║            Dramo 部署状态                     ║${NC}"
echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"

print_status() {
    local name="$1"
    local ok="$2"
    if $ok; then
        echo -e "║  ${name}:  ${GREEN}✓ 运行中${NC}"
    else
        echo -e "║  ${name}:  ${RED}✗ 未就绪${NC}"
    fi
}
print_status "AgentOS " "$AGENTOS_OK"
print_status "API     " "$API_OK"
print_status "Web     " "$WEB_OK"

echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"

if $AGENTOS_OK && $API_OK && $WEB_OK; then
    echo -e "║  ${GREEN}${BOLD}部署成功！${NC}"
    echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"
    echo -e "║  前端:       ${CYAN}http://${SERVER_IP}${NC}"
    echo -e "║  API 健康:   ${CYAN}http://${SERVER_IP}/api/health${NC}"
    echo -e "${BOLD}╠══════════════════════════════════════════════╣${NC}"
    echo -e "║  更新:  cd $INSTALL_DIR && ./deploy/update.sh"
    echo -e "║  日志:  cd $INSTALL_DIR && ./deploy/logs.sh"
    echo -e "║  状态:  docker compose ps"
else
    echo -e "║  ${RED}${BOLD}部分服务未就绪，请检查日志：${NC}"
    echo -e "║  docker compose logs"
fi

echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
```

- [ ] **Step 2: 设置可执行权限**

```bash
chmod +x deploy/setup-dramo.sh
```

- [ ] **Step 3: Commit**

```bash
git add deploy/setup-dramo.sh
git commit -m "feat: add one-click VPS deployment script"
```

---

### Task 7: 运维脚本 update.sh + logs.sh

**Files:**
- Create: `deploy/update.sh`
- Create: `deploy/logs.sh`

- [ ] **Step 1: 创建 deploy/update.sh**

```bash
#!/bin/bash
# Dramo — 更新部署
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INSTALL_DIR"

echo -e "${BOLD}${CYAN}Dramo 更新部署${NC}"
echo ""

# 拉取最新代码
echo -e "${BOLD}1. 拉取最新代码...${NC}"
git pull origin main

# 重新构建
echo -e "${BOLD}2. 构建镜像...${NC}"
docker compose build --parallel

# 重启服务（会自动替换旧容器）
echo -e "${BOLD}3. 重启服务...${NC}"
docker compose up -d --remove-orphans

# 等待健康检查
echo -e "${BOLD}4. 等待服务就绪...${NC}"
sleep 10

if docker compose ps | grep -q "unhealthy\|Exit"; then
    echo -e "${RED}有服务异常，请检查:${NC}"
    docker compose ps
    echo ""
    echo "查看日志: docker compose logs"
    exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}更新完成！${NC}"
docker compose ps
```

- [ ] **Step 2: 创建 deploy/logs.sh**

```bash
#!/bin/bash
# Dramo — 查看服务日志
# 用法:
#   ./deploy/logs.sh           所有服务最近 100 行
#   ./deploy/logs.sh api       指定服务
#   ./deploy/logs.sh -f        实时跟踪所有服务
#   ./deploy/logs.sh api -f    实时跟踪指定服务

INSTALL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$INSTALL_DIR"

SERVICE=""
FOLLOW=false

for arg in "$@"; do
    case "$arg" in
        -f|--follow) FOLLOW=true ;;
        *) SERVICE="$arg" ;;
    esac
done

if $FOLLOW; then
    docker compose logs -f $SERVICE
else
    docker compose logs --tail=100 $SERVICE
fi
```

- [ ] **Step 3: 设置可执行权限**

```bash
chmod +x deploy/update.sh deploy/logs.sh
```

- [ ] **Step 4: Commit**

```bash
git add deploy/update.sh deploy/logs.sh
git commit -m "feat: add update and logs helper scripts"
```

---

### Task 8: 端到端验证

- [ ] **Step 1: 本地验证 docker compose 配置**

Run: `cd /Users/halyu/Documents/Code/dramo && docker compose config --quiet 2>&1`

Expected: 无报错。环境变量缺失的 warning 正常（服务器上有 .env）。

- [ ] **Step 2: 验证文件完整性**

检查所有新文件存在且可执行：

```bash
ls -la deploy/setup-dramo.sh deploy/update.sh deploy/logs.sh deploy/nginx.conf deploy/.env.template
test -f web/Dockerfile && echo "web/Dockerfile OK" || echo "MISSING"
test -f web/.dockerignore && echo "web/.dockerignore OK" || echo "MISSING"
```

Expected: 所有文件存在，.sh 文件有 x 权限。

- [ ] **Step 3: 验证 Nginx 配置语法**

```bash
docker run --rm -v $(pwd)/deploy/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
```

Expected: `nginx: configuration file /etc/nginx/nginx.conf syntax is ok`

- [ ] **Step 4: Commit 最终验证通过**

如果有任何修复，提交：

```bash
git add -A
git commit -m "fix: address issues found during deployment verification"
```

如果无修复则跳过此步。
