#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="${KIND_CLUSTER_NAME:-modular-backend-lab}"
NAMESPACE="${K8S_NAMESPACE:-modular-backend-lab}"
EXPECTED_CONTEXT="kind-${CLUSTER_NAME}"
ROLLOUT_TIMEOUT="${K8S_ROLLOUT_TIMEOUT:-180s}"
MIGRATION_WAIT_TIMEOUT="${K8S_MIGRATION_WAIT_TIMEOUT:-900s}"
REQUEST_TIMEOUT="${K8S_SMOKE_REQUEST_TIMEOUT:-15s}"
MIGRATION_JOB="modular-backend-lab-migration"

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

fail_with_output() {
  local message="$1"
  local output="${2:-}"

  printf 'ERROR: %s\n' "$message" >&2
  if [[ -n "$output" ]]; then
    printf '%s\n' "$output" >&2
  fi
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
  fi
}

kubectl_get_or_fail() {
  local description="$1"
  shift
  local output

  if ! output="$(kubectl "$@" 2>&1)"; then
    fail_with_output "$description" "$output"
  fi
}

check_kubectl_access() {
  local context
  local output

  require_command kubectl

  if ! context="$(kubectl config current-context 2>&1)"; then
    fail_with_output "kubectl has no current context for local kind smoke" "$context"
  fi

  if [[ "$context" != "$EXPECTED_CONTEXT" ]]; then
    fail "local kind smoke must run against kubectl context/${EXPECTED_CONTEXT}; current context is ${context}"
  fi

  if ! output="$(kubectl --request-timeout="$REQUEST_TIMEOUT" cluster-info 2>&1)"; then
    fail_with_output "kubectl cannot reach context/${EXPECTED_CONTEXT}" "$output"
  fi

  log "OK: kubectl can reach context/${EXPECTED_CONTEXT}"
}

check_namespace() {
  kubectl_get_or_fail \
    "namespace/${NAMESPACE} is missing or inaccessible in context/${EXPECTED_CONTEXT}; run scripts/k8s-local-up.sh first" \
    get namespace "$NAMESPACE" -o name

  log "OK: namespace/${NAMESPACE} exists"
}

print_pods_for_debug() {
  local selector="$1"

  kubectl -n "$NAMESPACE" get pods -l "$selector" -o wide >&2 || true
}

wait_deployment_rollout() {
  local deployment="$1"
  local selector="$2"
  local output

  kubectl_get_or_fail \
    "deployment/${deployment} is missing in namespace/${NAMESPACE}" \
    -n "$NAMESPACE" get "deployment/${deployment}" -o name

  if ! output="$(kubectl -n "$NAMESPACE" rollout status "deployment/${deployment}" --timeout="$ROLLOUT_TIMEOUT" 2>&1)"; then
    printf 'ERROR: rollout failed for deployment/%s in namespace/%s\n' "$deployment" "$NAMESPACE" >&2
    printf '%s\n' "$output" >&2
    kubectl -n "$NAMESPACE" describe "deployment/${deployment}" >&2 || true
    print_pods_for_debug "$selector"
    exit 1
  fi

  log "OK: deployment/${deployment} rollout complete"
}

wait_migration_job() {
  local output

  kubectl_get_or_fail \
    "job/${MIGRATION_JOB} is missing in namespace/${NAMESPACE}; run scripts/k8s-local-up.sh to create the local migration job" \
    -n "$NAMESPACE" get "job/${MIGRATION_JOB}" -o name

  if ! output="$(kubectl -n "$NAMESPACE" wait --for=condition=complete "job/${MIGRATION_JOB}" --timeout="$MIGRATION_WAIT_TIMEOUT" 2>&1)"; then
    printf 'ERROR: migration job/%s did not complete in namespace/%s within %s\n' "$MIGRATION_JOB" "$NAMESPACE" "$MIGRATION_WAIT_TIMEOUT" >&2
    printf '%s\n' "$output" >&2
    kubectl -n "$NAMESPACE" describe "job/${MIGRATION_JOB}" >&2 || true
    kubectl -n "$NAMESPACE" logs "job/${MIGRATION_JOB}" --all-containers=true --tail=200 >&2 || true
    exit 1
  fi

  log "OK: job/${MIGRATION_JOB} complete"
}

require_service_endpoints() {
  local service="$1"
  local endpoint_ips
  local output

  if ! output="$(kubectl -n "$NAMESPACE" get "service/${service}" -o name 2>&1)"; then
    fail_with_output "service/${service} is missing in namespace/${NAMESPACE}" "$output"
  fi

  if ! endpoint_ips="$(kubectl -n "$NAMESPACE" get "endpoints/${service}" -o jsonpath='{.subsets[*].addresses[*].ip}' 2>&1)"; then
    fail_with_output "endpoints/${service} are missing in namespace/${NAMESPACE}" "$endpoint_ips"
  fi

  if [[ -z "$endpoint_ips" ]]; then
    fail "service/${service} has no ready endpoints in namespace/${NAMESPACE}"
  fi
}

check_service_proxy_path() {
  local description="$1"
  local service_proxy="$2"
  local path="$3"
  local output
  local proxy_path="/api/v1/namespaces/${NAMESPACE}/services/${service_proxy}/proxy${path}"

  if ! output="$(kubectl --request-timeout="$REQUEST_TIMEOUT" get --raw "$proxy_path" 2>&1 >/dev/null)"; then
    fail_with_output "${description} is not reachable through Kubernetes service proxy (${proxy_path})" "$output"
  fi

  log "OK: ${description} reachable"
}

check_api_health() {
  require_service_endpoints "api"
  check_service_proxy_path "service/api /healthz" "api:http" "/healthz"
  check_service_proxy_path "service/api /readyz" "api:http" "/readyz"
}

deployment_exists() {
  local deployment="$1"

  kubectl -n "$NAMESPACE" get "deployment/${deployment}" >/dev/null 2>&1
}

check_optional_observability_http() {
  local deployment="$1"
  local service="$2"
  local service_proxy="$3"
  local path="$4"

  if ! deployment_exists "$deployment"; then
    log "SKIP: deployment/${deployment} is not deployed"
    return
  fi

  wait_deployment_rollout "$deployment" "app.kubernetes.io/name=${deployment}"
  require_service_endpoints "$service"
  check_service_proxy_path "observability service/${service} ${path}" "$service_proxy" "$path"
}

check_optional_observability_endpoints() {
  local deployment="$1"
  local service="$2"

  if ! deployment_exists "$deployment"; then
    log "SKIP: deployment/${deployment} is not deployed"
    return
  fi

  wait_deployment_rollout "$deployment" "app.kubernetes.io/name=${deployment}"
  require_service_endpoints "$service"
  log "OK: observability service/${service} has ready endpoint(s)"
}

check_kubectl_access
check_namespace

wait_migration_job
wait_deployment_rollout "api" "app.kubernetes.io/component=api"
wait_deployment_rollout "worker" "app.kubernetes.io/component=worker"
wait_deployment_rollout "scheduler" "app.kubernetes.io/component=scheduler"
check_api_health

check_optional_observability_http "grafana" "grafana" "grafana:http" "/api/health"
check_optional_observability_http "prometheus" "prometheus" "prometheus:http" "/-/ready"
check_optional_observability_http "tempo" "tempo" "tempo:http" "/ready"
check_optional_observability_http "loki" "loki" "loki:http" "/ready"
check_optional_observability_http "kube-state-metrics" "kube-state-metrics" "kube-state-metrics:http" "/metrics"
check_optional_observability_endpoints "alloy" "alloy"

log "Local kind runtime smoke verification passed."
