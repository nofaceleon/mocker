#!/usr/bin/env bash
set -e

cd "$(dirname "$0")"

PID_FILE="$(pwd)/.mocker.pid"
LOG_FILE="$(pwd)/.mocker.log"

usage() {
  cat <<EOF
用法: $0 {start [-d]|stop|restart [-d]|status}
  start          前台启动（默认）
  start -d       守护启动（后台运行）
  stop           停止服务
  restart [-d]   重启服务
  status         查看运行状态
EOF
}

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

ensure_deps() {
  if [ ! -d "node_modules" ]; then
    echo ">> 安装依赖..."
    pnpm install
  fi
}

read_env() {
  local key=$1 fallback=$2
  if [ -f ".env" ]; then
    local val
    val=$(grep -E "^${key}=" .env | head -1 | cut -d= -f2 | tr -d '[:space:]')
    [ -n "$val" ] && echo "$val" || echo "$fallback"
  else
    echo "$fallback"
  fi
}

do_start() {
  local daemon=$1

  if is_running; then
    echo ">> 已在运行 (PID: $(cat "$PID_FILE"))"
    return 0
  fi

  ensure_deps
  rm -f "$PID_FILE"

  local node_env
  node_env=$(read_env NODE_ENV development)

  local run_cmd
  local port_msg
  if [ "$node_env" = "production" ]; then
    # 生产模式：后端托管前端静态文件，只需一个进程
    run_cmd="pnpm start"
    port_msg="启动服务 (localhost:3000)"
  else
    # 开发模式：前后端独立热重载
    run_cmd="pnpm dev"
    port_msg="启动后端 (localhost:3000) + 前端 (localhost:5173)"
  fi

  if [ "$daemon" = true ]; then
    echo "========================================"
    echo "  MockHub - 守护模式启动"
    echo "========================================"
    nohup $run_cmd >> "$LOG_FILE" 2>&1 &
    local pid=$!
    echo "$pid" > "$PID_FILE"

    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
      echo ">> 已守护启动 (PID: $pid)"
      echo ">> 日志文件: $LOG_FILE"
    else
      echo ">> 启动失败，请查看日志: $LOG_FILE" >&2
      rm -f "$PID_FILE"
      return 1
    fi
  else
    echo "========================================"
    echo "  MockHub - 通用接口 Mock 服务平台"
    echo "========================================"
    echo ">> $port_msg"
    $run_cmd
  fi
}

do_stop() {
  local stopped=false

  # 1) 优先按 PID 文件优雅停服
  if is_running; then
    local pid
    pid=$(cat "$PID_FILE")
    echo ">> 停止主进程 (PID: $pid)..."
    stopped=true

    set +e
    kill -TERM "$pid" 2>/dev/null
    local i
    for i in 1 2 3 4 5; do
      kill -0 "$pid" 2>/dev/null || break
      sleep 1
    done

    if kill -0 "$pid" 2>/dev/null; then
      echo ">> 主进程未响应，强制停止..."
      pkill -KILL -P "$pid" 2>/dev/null
      kill -KILL "$pid" 2>/dev/null
    fi
    set -e
  fi

  # 2) 兜底：清理 MockHub 相关进程
  echo ">> 清理 MockHub 相关进程..."
  set +e
  local node_env
  node_env=$(read_env NODE_ENV development)
  pkill -f "@mockhub/backend" 2>/dev/null
  if [ "$node_env" != "production" ]; then
    pkill -f "concurrently.*backend.*frontend" 2>/dev/null
    pkill -f "pnpm.*--filter.*@mockhub/(backend|frontend)" 2>/dev/null
    pkill -f "@mockhub/frontend" 2>/dev/null
  fi
  set -e

  # 3) 兜底：清理监听端口的进程
  if command -v lsof >/dev/null 2>&1; then
    local ports=()
    local env_port
    env_port=$(read_env PORT 3000)
    ports+=("$env_port")
    if [ "$node_env" != "production" ]; then
      ports+=(5173)
    fi

    set +e
    for port in "${ports[@]}"; do
      local pids
      pids=$(lsof -ti :"$port" 2>/dev/null | tr '\n' ' ')
      if [ -n "$(echo "$pids" | xargs)" ]; then
        echo ">> 清理端口 $port 残留进程: $pids"
        echo "$pids" | xargs kill -KILL 2>/dev/null
        stopped=true
      fi
    done
    set -e
  fi

  rm -f "$PID_FILE"

  if [ "$stopped" = true ]; then
    echo ">> 已停止"
  else
    echo ">> 未运行"
  fi
}

do_status() {
  if is_running; then
    echo ">> 运行中 (PID: $(cat "$PID_FILE"))"
    if [ -f "$LOG_FILE" ]; then
      echo ">> 日志文件: $LOG_FILE"
    fi
  else
    echo ">> 未运行"
    [ -f "$PID_FILE" ] && rm -f "$PID_FILE"
  fi
}

cmd="${1:-start}"
shift || true

case "$cmd" in
  start)
    daemon=false
    while [ $# -gt 0 ]; do
      case "$1" in
        -d|--daemon) daemon=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "未知选项: $1" >&2; usage; exit 1 ;;
      esac
    done
    do_start "$daemon"
    ;;

  stop)
    do_stop
    ;;

  restart)
    daemon=false
    while [ $# -gt 0 ]; do
      case "$1" in
        -d|--daemon) daemon=true; shift ;;
        -h|--help) usage; exit 0 ;;
        *) echo "未知选项: $1" >&2; usage; exit 1 ;;
      esac
    done
    do_stop
    do_start "$daemon"
    ;;

  status)
    do_status
    ;;

  -h|--help|help)
    usage
    ;;

  *)
    usage
    exit 1
    ;;
esac