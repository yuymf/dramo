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
