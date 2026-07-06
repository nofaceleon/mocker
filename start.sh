#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

echo "========================================"
echo "  MockHub - 通用接口 Mock 服务平台"
echo "========================================"

if [ ! -d "node_modules" ]; then
  echo ">> 安装依赖..."
  pnpm install
fi

echo ">> 启动后端 (localhost:3000) + 前端 (localhost:5173)"
pnpm dev
