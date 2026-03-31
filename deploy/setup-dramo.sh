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
