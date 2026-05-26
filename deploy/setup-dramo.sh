#!/bin/bash
set -e

echo "╔══════════════════════════════════╗"
echo "║     Dramo 一键部署脚本           ║"
echo "╚══════════════════════════════════╝"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "📦 正在安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  echo "✅ Docker 安装完成"
fi

if ! docker compose version &> /dev/null; then
  echo "❌ 需要 Docker Compose v2+. 请升级 Docker."
  exit 1
fi

# Generate .env if not exists
if [ ! -f .env ]; then
  echo "🔧 生成环境配置..."

  ENCRYPTION_KEY=$(openssl rand -hex 32)
  DB_PASSWORD=$(openssl rand -base64 16 | tr -d '=/+')
  AGENTOS_KEY=$(openssl rand -base64 24 | tr -d '=/+')

  cat > .env << EOF
# Dramo 自动生成配置 — $(date +%Y-%m-%d)
DB_PASSWORD=${DB_PASSWORD}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
AGENTOS_KEY=${AGENTOS_KEY}
PORT=80
PUBLIC_URL=http://localhost

# LLM API Key (启动后也可在界面中配置)
# OPENAI_API_KEY=sk-xxx
EOF

  echo "✅ 已生成 .env"
else
  echo "ℹ️  .env 已存在，跳过生成"
fi

# Build and start
echo ""
echo "🚀 启动服务..."
docker compose up -d --build

echo ""
echo "╔══════════════════════════════════╗"
echo "║        部署完成！                ║"
echo "╠══════════════════════════════════╣"
echo "║  访问: http://localhost          ║"
echo "║                                  ║"
echo "║  配置 LLM:                       ║"
echo "║    界面 → 设置 → LLM 配置        ║"
echo "║    或编辑 .env 后重启             ║"
echo "║                                  ║"
echo "║  常用命令:                        ║"
echo "║    docker compose logs -f        ║"
echo "║    docker compose restart        ║"
echo "║    docker compose down           ║"
echo "╚══════════════════════════════════╝"
