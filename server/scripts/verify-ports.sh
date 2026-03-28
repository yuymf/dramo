#!/bin/bash

# 端口配置验证脚本
# 用途：验证所有服务的端口配置是否正确

set -e

echo "================================"
echo "端口配置验证脚本"
echo "================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} 端口 $port ($service) 正在运行"
        return 0
    else
        echo -e "${RED}✗${NC} 端口 $port ($service) 未运行"
        return 1
    fi
}

# 检查配置文件
check_config() {
    local file=$1
    local pattern=$2
    local description=$3
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $description"
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        return 1
    fi
}

echo "1. 检查配置文件"
echo "----------------------------"

# Backend 配置
check_config "env.example" "PORT=12321" "Backend 端口配置 (12321)"
check_config "env.example" "AGENTOS_BASE_URL=http://localhost:12322" "AgentOS URL 配置"
check_config "docker-compose.yml" "12321:12321" "Docker Backend 端口映射"

# AgentOS 配置
check_config "agentos/env.example" "PORT=12322" "AgentOS 端口配置 (12322)"
check_config "docker-compose.yml" "12322:12322" "Docker AgentOS 端口映射"

# TypeScript 配置
check_config "src/config/index.ts" "12321" "Backend config.ts 默认端口"
check_config "src/config/index.ts" "12322" "AgentOS config.ts 默认端口"

echo ""
echo "2. 检查运行中的服务"
echo "----------------------------"

# 检查端口占用
check_port 12321 "Backend API" || echo -e "${YELLOW}提示: 如需启动，运行 'npm run dev' 或 'docker compose up'${NC}"
check_port 12322 "AgentOS" || echo -e "${YELLOW}提示: 如需启动，运行 'cd agentos && python app.py' 或 'docker compose up'${NC}"
check_port 12323 "Frontend" || echo -e "${YELLOW}提示: 如需启动，在项目根目录运行 'npm run dev'${NC}"

echo ""
echo "3. 测试服务连通性"
echo "----------------------------"

# 测试 Backend API
if curl -s http://localhost:12321/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend API 健康检查通过 (http://localhost:12321/api/health)"
else
    echo -e "${YELLOW}⚠${NC} Backend API 健康检查失败或服务未运行"
fi

# 测试 AgentOS
if curl -s http://localhost:12322/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} AgentOS 健康检查通过 (http://localhost:12322/health)"
else
    echo -e "${YELLOW}⚠${NC} AgentOS 健康检查失败或服务未运行"
fi

# 测试 Frontend（检查端口占用即可）
if lsof -Pi :12323 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Frontend 正在运行 (http://localhost:12323)"
else
    echo -e "${YELLOW}⚠${NC} Frontend 未运行"
fi

echo ""
echo "4. 端口冲突检查"
echo "----------------------------"

# 检查是否有进程占用旧端口
OLD_PORTS=(3000 8000)
for port in "${OLD_PORTS[@]}"; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠${NC} 端口 $port 被占用（旧版本端口，建议检查）"
        lsof -Pi :$port -sTCP:LISTEN | head -2
    fi
done

echo ""
echo "================================"
echo "验证完成"
echo "================================"
echo ""
echo "📚 相关文档："
echo "  - 端口配置说明: PORT_CONFIGURATION.md"
echo "  - 变更总结: PORT_CHANGE_SUMMARY.md"
echo "  - 快速开始: backend/START_HERE.md"
echo ""
echo "🚀 快速启动命令："
echo "  Docker:  cd backend && docker compose up -d"
echo "  本地:    cd backend/agentos && python app.py (终端1)"
echo "          cd backend && npm run dev (终端2)"
echo "          npm run dev (终端3, 在项目根目录)"
echo ""


