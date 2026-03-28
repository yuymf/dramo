#!/bin/bash
# ============================================================
#  Dramo — 一键环境切换脚本
#  用法：
#    ./switch-env.sh debug      切换到 DEBUG 模式（全部本地）
#    ./switch-env.sh prod       切换到 PRODUCTION 模式（连接远端）
#    ./switch-env.sh status     查看当前模式
# ============================================================

set -e

# --- 路径配置 ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
WEB_DIR="$SCRIPT_DIR/web"

# --- 颜色 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# --- 辅助函数 ---
print_header() {
    echo ""
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║   Dramo 环境切换工具                    ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}"
    echo ""
}

print_status() {
    echo -e "${BOLD}当前环境状态：${NC}"
    echo ""

    # 检查前端
    if [ -f "$WEB_DIR/.env.local" ]; then
        local front_api=$(grep "^NEXT_PUBLIC_API_URL=" "$WEB_DIR/.env.local" | cut -d= -f2)
        if echo "$front_api" | grep -q "localhost"; then
            echo -e "  前端 API:    ${GREEN}本地${NC}  -> $front_api"
        else
            echo -e "  前端 API:    ${BLUE}远端${NC}  -> $front_api"
        fi
    else
        echo -e "  前端 API:    ${RED}未配置${NC} (.env.local 不存在)"
    fi

    # 检查后端
    if [ -f "$SERVER_DIR/.env" ]; then
        local back_agentos=$(grep "^AGENTOS_BASE_URL=" "$SERVER_DIR/.env" | cut -d= -f2)
        local back_loglevel=$(grep "^LOG_LEVEL=" "$SERVER_DIR/.env" | cut -d= -f2)
        if echo "$back_agentos" | grep -q "localhost"; then
            echo -e "  AgentOS:     ${GREEN}本地${NC}  -> $back_agentos"
        else
            echo -e "  AgentOS:     ${BLUE}远端${NC}  -> $back_agentos"
        fi
        echo -e "  日志级别:    $back_loglevel"
    else
        echo -e "  后端:        ${RED}未配置${NC} (.env 不存在)"
    fi

    echo ""
}

switch_debug() {
    echo -e "${GREEN}${BOLD}切换到 DEBUG 模式...${NC}"
    echo ""

    if [ ! -f "$SCRIPT_DIR/.env.debug" ]; then
        echo -e "  ${RED}根目录 .env.debug 文件不存在${NC}"
        exit 1
    fi

    # 生成 server/.env（提取后端变量）
    grep -E "^(NODE_ENV|PORT|LOG_LEVEL|DATABASE_URL|JWT_SECRET|JWT_EXPIRES_IN|AGENTOS_BASE_URL|AGENTOS_SECURITY_KEY|ENCRYPTION_KEY|STORAGE_DRIVER|STORAGE_LOCAL_DIR|STORAGE_BASE_URL|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_BUCKET|SUPABASE_SIGNED_URL_TTL|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_PRICE_PRO_MONTHLY|STRIPE_PRICE_PRO_YEARLY|FRONTEND_URL|AI_PROVIDER|OPENAI_API_KEY|OPENAI_API_BASE|OPENAI_MODEL_ID|HUNYUAN_OPENAPI_KEY|HUNYUAN_OPENAPI_URL|HUNYUAN_MODEL_ID|ARK_API_KEY|SSE_TIMEOUT_MS|SSE_HEARTBEAT_MS)=" "$SCRIPT_DIR/.env.debug" > "$SERVER_DIR/.env"
    echo -e "  ${GREEN}OK${NC} server/.env -> 本地 AgentOS (localhost:12322)"

    # 生成 web/.env.local（提取前端变量）
    grep -E "^(NEXTAUTH_SECRET|NEXTAUTH_URL|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_APP_MODE|DEV_USER_EMAIL|DEV_USER_PASSWORD|DEV_USER_NAME)=" "$SCRIPT_DIR/.env.debug" > "$WEB_DIR/.env.local"
    echo -e "  ${GREEN}OK${NC} web/.env.local -> 本地后端 (localhost:12321)"

    echo ""
    echo -e "${YELLOW}${BOLD}DEBUG 模式架构：${NC}"
    echo ""
    echo -e "  web (:12323)  ->  server (:12321)  ->  agentos (:12322)"
    echo -e "       本地            本地                  本地"
    echo ""
    echo -e "${YELLOW}一键启动：${NC} npm run dev"
    echo ""
}

switch_prod() {
    echo -e "${BLUE}${BOLD}切换到 PRODUCTION 模式...${NC}"
    echo ""

    if [ ! -f "$SCRIPT_DIR/.env.production" ]; then
        echo -e "  ${RED}根目录 .env.production 文件不存在${NC}"
        exit 1
    fi

    # 生成 server/.env（提取后端变量）
    grep -E "^(NODE_ENV|PORT|LOG_LEVEL|DATABASE_URL|JWT_SECRET|JWT_EXPIRES_IN|AGENTOS_BASE_URL|AGENTOS_SECURITY_KEY|ENCRYPTION_KEY|STORAGE_DRIVER|STORAGE_LOCAL_DIR|STORAGE_BASE_URL|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_BUCKET|SUPABASE_SIGNED_URL_TTL|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_PRICE_PRO_MONTHLY|STRIPE_PRICE_PRO_YEARLY|FRONTEND_URL|AI_PROVIDER|OPENAI_API_KEY|OPENAI_API_BASE|OPENAI_MODEL_ID|HUNYUAN_OPENAPI_KEY|HUNYUAN_OPENAPI_URL|HUNYUAN_MODEL_ID|ARK_API_KEY|SSE_TIMEOUT_MS|SSE_HEARTBEAT_MS)=" "$SCRIPT_DIR/.env.production" > "$SERVER_DIR/.env"
    echo -e "  ${GREEN}OK${NC} server/.env -> 远端 AgentOS"

    # 生成 web/.env.local（提取前端变量）
    grep -E "^(NEXTAUTH_SECRET|NEXTAUTH_URL|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_APP_MODE|DEV_USER_EMAIL|DEV_USER_PASSWORD|DEV_USER_NAME)=" "$SCRIPT_DIR/.env.production" > "$WEB_DIR/.env.local"
    echo -e "  ${GREEN}OK${NC} web/.env.local -> 远端 API"

    echo ""
    echo -e "${BLUE}${BOLD}PRODUCTION 模式架构：${NC}"
    echo ""
    echo -e "  web (:12323)  ->  远端 API  ->  远端 AgentOS"
    echo -e "       本地           远端          远端"
    echo ""
    echo -e "${YELLOW}只需启动前端：${NC} npm run dev:web"
    echo ""
}

# --- 主逻辑 ---
print_header

case "${1:-}" in
    debug|d)
        switch_debug
        ;;
    prod|p|production)
        switch_prod
        ;;
    status|s)
        print_status
        ;;
    *)
        echo -e "${BOLD}用法：${NC}"
        echo ""
        echo -e "  ${GREEN}./switch-env.sh debug${NC}      切换到 DEBUG 模式（全部本地）"
        echo -e "  ${BLUE}./switch-env.sh prod${NC}       切换到 PRODUCTION 模式（连接远端）"
        echo -e "  ${CYAN}./switch-env.sh status${NC}     查看当前环境状态"
        echo ""
        echo -e "${BOLD}快捷别名：${NC} debug -> d | prod -> p | status -> s"
        echo ""
        print_status
        ;;
esac
