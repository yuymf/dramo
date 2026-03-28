#!/bin/bash
# Docker 环境下的数据库迁移脚本

set -e

echo "🚀 开始 Docker 环境迁移..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

# 使用 docker compose 或 docker-compose
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo -e "${YELLOW}📋 步骤 1/5: 检查环境变量...${NC}"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env 文件不存在，从 env.example 复制...${NC}"
    cp env.example .env
    echo -e "${RED}⚠️  请编辑 .env 文件，设置必要的环境变量（DATABASE_URL, OPENAI_API_KEY 等）${NC}"
    echo -e "${YELLOW}按回车键继续...${NC}"
    read
fi

# 检查必要的环境变量
source .env
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL 未设置${NC}"
    exit 1
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY 未设置，图片生成功能将无法使用${NC}"
fi

echo -e "${GREEN}✓ 环境变量检查完成${NC}"

echo -e "${YELLOW}📋 步骤 2/5: 停止现有容器...${NC}"
$DOCKER_COMPOSE down

echo -e "${YELLOW}📋 步骤 3/5: 构建新镜像...${NC}"
$DOCKER_COMPOSE build --no-cache

echo -e "${YELLOW}📋 步骤 4/5: 启动服务（仅数据库和 Redis）...${NC}"
$DOCKER_COMPOSE up -d redis

# 等待 Redis 就绪
echo "等待 Redis 启动..."
sleep 3

echo -e "${YELLOW}📋 步骤 5/5: 执行数据库迁移...${NC}"

# 临时启动一个容器来执行迁移
echo "创建迁移..."
$DOCKER_COMPOSE run --rm -e DATABASE_URL="$DATABASE_URL" api sh -c "
  npx prisma generate &&
  npx prisma migrate deploy
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 数据库迁移成功！${NC}"
else
    echo -e "${RED}❌ 数据库迁移失败${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 启动所有服务...${NC}"
$DOCKER_COMPOSE up -d

echo ""
echo -e "${GREEN}🎉 迁移和部署完成！${NC}"
echo ""
echo "服务状态："
$DOCKER_COMPOSE ps
echo ""
echo "访问："
echo "  - API: http://localhost:12321/api/health"
echo "  - 前端: http://localhost:12323"
echo ""
echo "查看日志："
echo "  $DOCKER_COMPOSE logs -f api"
echo "  $DOCKER_COMPOSE logs -f worker"
echo ""
echo "停止服务："
echo "  $DOCKER_COMPOSE down"

