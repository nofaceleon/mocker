#!/usr/bin/env bash
# 端到端烟雾测试：模拟延时回调功能
# 用法：先启动 backend (pnpm dev)，再 `./scripts/callback-smoke.sh`
#
# 流程：
# 1) 用 node 起一个 echo 服务，监听 9888，把收到的请求 POST 写入 /tmp/cb-received.log
# 2) 通过 REST 创建/复用项目 → 功能组 → mock api（启用回调，URL 指向 echo）
# 3) curl 触发 mock 路径，立即返回 202
# 4) 等 6 秒，验证 echo 收到请求
# 5) 查 /api/callback-tasks?apiId=xxx 拿到 sent 状态
# 6) 还原（删除测试 project + 关 echo 服务）

set -euo pipefail

BASE="http://127.0.0.1:3000"
LOG_DIR="$(mktemp -d -t callback-smoke)"
RECEIVED="$LOG_DIR/received.log"
ECHO_PID=""
PROJECT_ID=""

cleanup() {
  if [[ -n "$ECHO_PID" ]] && kill -0 "$ECHO_PID" 2>/dev/null; then
    kill -9 "$ECHO_PID" 2>/dev/null || true
    wait "$ECHO_PID" 2>/dev/null || true
  fi
  if [[ -n "$PROJECT_ID" ]]; then
    curl -sS -X DELETE "$BASE/api/projects/$PROJECT_ID" >/dev/null 2>&1 || true
  fi
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT INT TERM

# 1) 启动 echo 服务（node）
RECV_LOG="$RECEIVED" node -e '
const http = require("http");
const fs = require("fs");
const out = process.env.RECV_LOG;
const srv = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    fs.appendFileSync(out, JSON.stringify({
      method: req.method, url: req.url, headers: req.headers, body
    }) + "\n");
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, ts: Date.now() }));
  });
});
srv.listen(9888, "127.0.0.1", () => console.log("echo listening 9888"));
' &
ECHO_PID=$!

# 等待 echo 真正 listening（最多 5s）
for _ in $(seq 1 50); do
  if (echo > /dev/tcp/127.0.0.1/9888) 2>/dev/null; then
    break
  fi
  sleep 0.1
done

echo "▶ 1/6 创建项目"
PROJECT_NAME="smoke-callback-$(date +%s%N)"
PROJECT_ID=$(curl -sS -X POST -H 'content-type: application/json' \
  -d "{\"name\":\"$PROJECT_NAME\",\"description\":\"smoke\"}" \
  "$BASE/api/projects" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
echo "  project_id=$PROJECT_ID"

echo "▶ 2/6 创建功能组"
FG_ID=$(curl -sS -X POST -H 'content-type: application/json' \
  -d '{"name":"smoke-fg","sortOrder":0}' \
  "$BASE/api/projects/$PROJECT_ID/feature-groups" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
echo "  fg_id=$FG_ID"

echo "▶ 3/6 创建 mock api（POST /cb/notify）"
API_BODY=$(cat <<EOF
{"name":"smoke-api","method":"POST","path":"/cb/notify","isEnabled":true,
 "responseStatus":200,
 "responseBody":{"code":0,"message":"accepted","traceId":"{{req.body.traceId}}"},
 "validationRules":{"body":[{"name":"traceId","type":"string","required":true}]}}
EOF
)
API_ID=$(curl -sS -X POST -H 'content-type: application/json' \
  -d "$API_BODY" \
  "$BASE/api/feature-groups/$FG_ID/mock-apis" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["data"]["id"])')
echo "  api_id=$API_ID"

echo "▶ 4/6 配置回调（POST http://127.0.0.1:9888/cb，延迟 3s，body 含 traceId）"
CB_BODY=$(cat <<EOF
{"isEnabled":true,
 "callbackUrl":"http://127.0.0.1:9888/cb",
 "callbackMethod":"POST",
 "callbackHeaders":{"Content-Type":"application/json"},
 "callbackBody":"{\"traceId\":\"{{req.body.traceId}}\",\"result\":\"{{response.data}}\"}",
 "delayType":"fixed","delayValue":"3000",
 "retryEnabled":true,"maxRetries":2,"retryInterval":1500,
 "retryStrategy":"fixed","retryCondition":"server_error"}
EOF
)
echo "  PUT /api/mock-apis/$API_ID/callback"
curl -sS -X PUT -H 'content-type: application/json' \
  -d "$CB_BODY" \
  "$BASE/api/mock-apis/$API_ID/callback"
echo ""

echo "▶ 5/6 触发 mock 接口（应立即返回）"
TIME=$(date +%s%3N)
curl -sS -X POST -H 'content-type: application/json' \
  -d '{"traceId":"smk-001"}' \
  "$BASE/cb/notify"
echo ""
echo "  triggered at $TIME"

echo "▶ 6/6 等待 5s，验证 echo 收到回调"
sleep 5
if [[ -s "$RECEIVED" ]]; then
  echo "  ✓ echo received:"
  cat "$RECEIVED"
  COUNT=$(wc -l < "$RECEIVED" | tr -d ' ')
  if [[ "$COUNT" -lt 1 ]]; then
    echo "✗ echo did not receive callback"; exit 1
  fi
else
  echo "✗ echo did not receive callback"; exit 1
fi

echo "▶ 校验 callback_tasks"
TASK_JSON=$(curl -sS "$BASE/api/callback-tasks?apiId=$API_ID")
echo "  $TASK_JSON"
STATUS=$(echo "$TASK_JSON" | python3 -c 'import sys,json;d=json.load(sys.stdin)["data"];print(d["items"][0]["status"] if d["items"] else "EMPTY")')
if [[ "$STATUS" == "sent" ]]; then
  echo "  ✓ task status=sent"
else
  echo "✗ task status=$STATUS (expected sent)"; exit 1
fi

echo ""
echo "✓ callback smoke test passed"
