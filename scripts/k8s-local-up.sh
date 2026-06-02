#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="${KIND_CLUSTER_NAME:-modular-backend-lab}"
NAMESPACE="${K8S_NAMESPACE:-modular-backend-lab}"
IMAGE_NAME="${APP_IMAGE:-modular-backend-lab:local}"
MIGRATION_WAIT_TIMEOUT="${K8S_MIGRATION_WAIT_TIMEOUT:-900s}"
RENDER_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$RENDER_DIR"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command docker
require_command kind
require_command kubectl

IMAGE_REPOSITORY="$IMAGE_NAME"
IMAGE_TAG="latest"
IMAGE_LAST_SEGMENT="${IMAGE_NAME##*/}"
if [[ "$IMAGE_LAST_SEGMENT" == *:* ]]; then
  IMAGE_REPOSITORY="${IMAGE_NAME%:*}"
  IMAGE_TAG="${IMAGE_NAME##*:}"
fi

mkdir -p "$RENDER_DIR/base" "$RENDER_DIR/local"
cp "$ROOT_DIR"/deploy/k8s/base/*.yaml "$RENDER_DIR/base"/
cp "$ROOT_DIR"/deploy/k8s/local/*.yaml "$RENDER_DIR/local"/

cat >"$RENDER_DIR/local/namespace.yaml" <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: "$NAMESPACE"
  labels:
    app.kubernetes.io/name: modular-backend-lab
    app.kubernetes.io/part-of: modular-backend-lab
EOF

cat >"$RENDER_DIR/local/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: "$NAMESPACE"
resources:
  - namespace.yaml
  - secrets.example.yaml
  - postgres.yaml
  - valkey.yaml
  - observability.yaml
  - ../base
images:
  - name: modular-backend-lab
    newName: "$IMAGE_REPOSITORY"
EOF

if [[ -n "$IMAGE_TAG" ]]; then
  cat >>"$RENDER_DIR/local/kustomization.yaml" <<EOF
    newTag: "$IMAGE_TAG"
EOF
fi

if ! kind get clusters | grep -Fxq "$CLUSTER_NAME"; then
  kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/deploy/k8s/local/kind-cluster.yaml"
fi

docker build -t "$IMAGE_NAME" "$ROOT_DIR"
kind load docker-image "$IMAGE_NAME" --name "$CLUSTER_NAME"

kubectl config use-context "kind-$CLUSTER_NAME" >/dev/null
kubectl apply -f "$RENDER_DIR/local/namespace.yaml"
kubectl -n "$NAMESPACE" delete job modular-backend-lab-migration --ignore-not-found=true
kubectl -n "$NAMESPACE" delete pdb api --ignore-not-found=true
kubectl apply -k "$RENDER_DIR/local"
kubectl -n "$NAMESPACE" rollout restart \
  deployment/api \
  deployment/worker \
  deployment/scheduler \
  deployment/grafana \
  deployment/prometheus \
  deployment/tempo \
  deployment/loki \
  deployment/alloy >/dev/null

kubectl -n "$NAMESPACE" wait --for=condition=available deployment/postgres --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/valkey --timeout=180s

if ! kubectl -n "$NAMESPACE" wait --for=condition=complete job/modular-backend-lab-migration --timeout="$MIGRATION_WAIT_TIMEOUT"; then
  kubectl -n "$NAMESPACE" logs job/modular-backend-lab-migration
  exit 1
fi

kubectl -n "$NAMESPACE" wait --for=condition=available deployment/api --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/worker --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/scheduler --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/grafana --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/prometheus --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/tempo --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/loki --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/alloy --timeout=180s
kubectl -n "$NAMESPACE" wait --for=condition=available deployment/kube-state-metrics --timeout=180s

kubectl -n "$NAMESPACE" get pods

cat <<EOF

Local Kubernetes baseline is running.

Open local ports with:
  scripts/k8s-local-port-forward.sh

Optional migration wait override:
  K8S_MIGRATION_WAIT_TIMEOUT=1200s scripts/k8s-local-up.sh

Then use:
  API health: http://localhost:3000/healthz
  API readiness: http://localhost:3000/readyz
  Grafana: http://localhost:3001
  Prometheus: http://localhost:9090

Grafana login:
  user: admin
  password: admin
EOF
