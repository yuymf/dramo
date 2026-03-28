#!/bin/bash
# 验证 Docker 部署脚本

set -e

echo "🔍 开始验证 Docker 部署..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 使用 docker compose 或 docker-compose
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo ""
echo -e "${YELLOW}📋 步骤 1/6: 检查容器状态...${NC}"
$DOCKER_COMPOSE ps

RUNNING_COUNT=$($DOCKER_COMPOSE ps | grep -c "Up" || echo "0")
if [ "$RUNNING_COUNT" -ge 4 ]; then
    echo -e "${GREEN}✅ 所有必需容器正在运行 ($RUNNING_COUNT 个)${NC}"
else
    echo -e "${RED}❌ 部分容器未运行${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 步骤 2/6: 检查 API 健康状态...${NC}"
API_HEALTH=$(curl -s http://localhost:12321/api/health || echo '{"ok":false}')
if echo "$API_HEALTH" | grep -q '"ok":true'; then
    echo -e "${GREEN}✅ API 健康检查通过${NC}"
    echo "$API_HEALTH"
else
    echo -e "${RED}❌ API 健康检查失败${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 步骤 3/6: 检查 Redis 连接...${NC}"
REDIS_PING=$($DOCKER_COMPOSE exec -T redis redis-cli ping || echo "FAIL")
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "${GREEN}✅ Redis 连接正常${NC}"
else
    echo -e "${RED}❌ Redis 连接失败${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 步骤 4/6: 检查数据库表...${NC}"
TABLE_EXISTS=$($DOCKER_COMPOSE exec -T postgres psql -U postgres -d story_agent -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='GenerationJob'" || echo "0")
if [ "$TABLE_EXISTS" -gt "0" ]; then
    echo -e "${GREEN}✅ GenerationJob 表已创建${NC}"
else
    echo -e "${RED}❌ GenerationJob 表不存在${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 步骤 5/6: 检查 Worker 日志...${NC}"
WORKER_STARTED=$($DOCKER_COMPOSE logs worker 2>&1 | grep -c "Image generation worker started" || echo "0")
if [ "$WORKER_STARTED" -ge 1 ]; then
    echo -e "${GREEN}✅ 图片生成 Worker 已启动 ($WORKER_STARTED 个实例)${NC}"
else
    echo -e "${RED}❌ 图片生成 Worker 未启动${NC}"
    echo "最近的 Worker 日志:"
    $DOCKER_COMPOSE logs worker --tail=20
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 步骤 6/6: 检查环境变量...${NC}"
if $DOCKER_COMPOSE exec -T api printenv | grep -q "OPENAI_API_KEY"; then
    echo -e "${GREEN}✅ OPENAI_API_KEY 已配置${NC}"
else
    echo -e "${RED}⚠️  OPENAI_API_KEY 未配置（图片生成将无法使用）${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 部署验证完成！所有检查通过！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 系统摘要:"
echo "  - API 服务: http://localhost:12321"
echo "  - 前端服务: http://localhost:12323"
echo "  - Worker 实例: $WORKER_STARTED"
echo ""
echo "🚀 下一步:"
echo "  1. 访问前端: http://localhost:12323"
echo "  2. 进入项目分镜页面"
echo "  3. 点击 '生成图片' 测试功能"
echo ""
echo "📋 查看日志:"
echo "  $DOCKER_COMPOSE logs -f api     # API 日志"
echo "  $DOCKER_COMPOSE logs -f worker  # Worker 日志"
echo ""
echo "🔍 监控队列:"
echo "  $DOCKER_COMPOSE exec redis redis-cli"
echo "  > KEYS bull:image-generation:*"
echo ""

