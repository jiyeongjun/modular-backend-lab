#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${KIND_CLUSTER_NAME:-modular-backend-lab}"
NAMESPACE="${K8S_NAMESPACE:-modular-backend-lab}"
IMAGE_NAME="${APP_IMAGE:-modular-backend-lab:local}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command docker
require_command kind
require_command kubectl

if ! kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
  kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/deploy/k8s/local/kind-cluster.yaml"
fi

docker build -t "$IMAGE_NAME" "$ROOT_DIR"
kind load docker-image "$IMAGE_NAME" --name "$CLUSTER_NAME"

kubectl config use-context "kind-$CLUSTER_NAME" >/dev/null
kubectl apply -f "$ROOT_DIR/deploy/k8s/local/namespace.yaml"
kubectl -n "$NAMESPACE" delete job modular-backend-lab-migration --ignore-not-found=true
kubectl apply -k "$ROOT_DIR/deploy/k8s/local"

kubectl -n "$NAMESPACE" wait --for=condition=available deployment/postgres --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/valkey --timeout=180s

if ! kubectl -n "$NAMESPACE" wait --for=condition=complete job/modular-backend-lab-migration --timeout=180s; then
  kubectl -n "$NAMESPACE" logs job/modular-backend-lab-migration
  exit 1
fi

kubectl -n "$NAMESPACE" wait --for=condition=available deployment/api --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/worker --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/scheduler --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/grafana --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/prometheus --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/kube-state-metrics --timeout=180s

kubectl -n "$NAMESPACE" get pods

cat <<EOF

Local Kubernetes baseline is running.

Open local ports with:
  scripts/k8s-local-port-forward.sh

Then use:
  API health: http://localhost:3000/healthz
  API readiness: http://localhost:3000/readyz
  Grafana: http://localhost:3001
  Prometheus: http://localhost:9090

Grafana login:
  user: admin
  password: admin
EOF
