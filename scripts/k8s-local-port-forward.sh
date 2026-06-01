#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${K8S_NAMESPACE:-modular-backend-lab}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "missing required command: kubectl" >&2
  exit 1
fi

cleanup() {
  local pids
  pids="$(jobs -p)"
  if [[ -n "$pids" ]]; then
    kill $pids
  fi
}

trap cleanup EXIT INT TERM

kubectl -n "$NAMESPACE" port-forward svc/api 3000:3000 &
kubectl -n "$NAMESPACE" port-forward svc/grafana 3001:3000 &
kubectl -n "$NAMESPACE" port-forward svc/prometheus 9090:9090 &

cat <<EOF
Port forwards are active.

API health: http://localhost:3000/healthz
API readiness: http://localhost:3000/readyz
Grafana: http://localhost:3001
Prometheus: http://localhost:9090

Grafana login:
  user: admin
  password: admin

Press Ctrl-C to stop port forwarding.
EOF

wait
