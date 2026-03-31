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
