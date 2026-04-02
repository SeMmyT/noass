#!/usr/bin/env bash
# statusline-bridge.sh — Pipe CC statusline metrics to NOASS + CCReStatus bridges.
# Reads JSON from stdin, POSTs metrics to both bridges, passes through to ccstatusline.
#
# Usage in ~/.claude/settings.json:
#   "statusLine": {
#     "type": "command",
#     "command": "bash /home/semmy/codeprojects/noass/server/tools/statusline-bridge.sh",
#     "padding": 0
#   }
set -uo pipefail

NOASS_URL="${NOASS_URL:-https://noass.semmy.dev}"
BRIDGE_URL="${CCSAVER_BRIDGE_URL:-http://localhost:4002}"
INPUT=$(cat)

# Fire-and-forget metrics POST to both servers in background
python3 -c "
import json, sys, urllib.request

data = json.loads(sys.argv[1])
session_id = data.get('session_id', '')
if not session_id:
    sys.exit(0)

metrics = {
    'session_id': session_id,
    'context_percent': (data.get('context_window') or {}).get('used_percentage'),
    'cost_usd': (data.get('cost') or {}).get('total_cost_usd'),
    'model': (data.get('model') or {}).get('display_name'),
    'cwd': (data.get('workspace') or {}).get('current_dir'),
    'lines_added': (data.get('cost') or {}).get('total_lines_added'),
    'lines_removed': (data.get('cost') or {}).get('total_lines_removed'),
    'duration_ms': (data.get('cost') or {}).get('total_duration_ms'),
    'api_duration_ms': (data.get('cost') or {}).get('total_api_duration_ms'),
}

body = json.dumps(metrics).encode()
headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Key': sys.argv[4],
}

for base in [sys.argv[2], sys.argv[3]]:
    url = base + '/session/' + session_id + '/metrics'
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    try:
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass
" "$INPUT" "$NOASS_URL" "$BRIDGE_URL" "${NOASS_WEBHOOK_KEY:-5f7b795ffa3d125ff2e076e4139577149a388bc4b107cb00e4e851143431c6b9}" >/dev/null 2>&1 &

# Pass through to ccstatusline for terminal display
if command -v ccstatusline >/dev/null 2>&1; then
  echo "$INPUT" | ccstatusline
else
  echo "$INPUT" | npx -y ccstatusline@latest
fi
