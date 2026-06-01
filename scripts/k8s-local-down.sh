#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${KIND_CLUSTER_NAME:-modular-backend-lab}"

if ! command -v kind >/dev/null 2>&1; then
  echo "missing required command: kind" >&2
  exit 1
fi

kind delete cluster --name "$CLUSTER_NAME"
