#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_KUSTOMIZATION="$ROOT_DIR/deploy/k8s/local"
K8S_LOCAL_UP_SCRIPT="$ROOT_DIR/scripts/k8s-local-up.sh"
RENDERED_MANIFEST="$(mktemp "${TMPDIR:-/tmp}/k8s-local-manifest.XXXXXX.yaml")"

cleanup() {
  rm -f "$RENDERED_MANIFEST"
}

trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1 (needed for local Kubernetes static validation)" >&2
    exit 1
  fi
}

require_command kubectl

kubectl kustomize "$LOCAL_KUSTOMIZATION" >"$RENDERED_MANIFEST"

if awk '
  function clean(value) {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
    gsub(/^"|"$/, "", value)
    return value
  }

  function finish_doc() {
    if (is_pdb && (metadata_name == "api" || has_api_component)) {
      if (metadata_name == "") {
        metadata_name = "<unknown>"
      }
      printf "local API PodDisruptionBudget is not allowed: %s\n", metadata_name > "/dev/stderr"
      found_api_pdb = 1
    }

    is_pdb = 0
    in_metadata = 0
    metadata_name = ""
    has_api_component = 0
  }

  /^---[[:space:]]*$/ {
    finish_doc()
    next
  }

  /^[^[:space:]]/ {
    in_metadata = 0
  }

  /^kind:[[:space:]]*PodDisruptionBudget[[:space:]]*$/ {
    is_pdb = 1
  }

  /^metadata:[[:space:]]*$/ {
    in_metadata = 1
    next
  }

  in_metadata && /^[[:space:]]+name:[[:space:]]*/ {
    value = $0
    sub(/^[[:space:]]*name:[[:space:]]*/, "", value)
    metadata_name = clean(value)
  }

  /app\.kubernetes\.io\/component:[[:space:]]*api[[:space:]]*$/ {
    has_api_component = 1
  }

  END {
    finish_doc()
    if (found_api_pdb) {
      exit 1
    }
  }
' "$RENDERED_MANIFEST"; then
  echo "OK: no local API PodDisruptionBudget is rendered"
else
  exit 1
fi

if ! migration_active_deadline="$(
  awk '
    function clean(value) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^"|"$/, "", value)
      return value
    }

    function finish_doc() {
      if (is_job && metadata_name == "modular-backend-lab-migration") {
        found_migration_job = 1
        observed_active_deadline = active_deadline
      }

      is_job = 0
      in_metadata = 0
      metadata_name = ""
      active_deadline = ""
    }

    /^---[[:space:]]*$/ {
      finish_doc()
      next
    }

    /^[^[:space:]]/ {
      in_metadata = 0
    }

    /^kind:[[:space:]]*Job[[:space:]]*$/ {
      is_job = 1
    }

    /^metadata:[[:space:]]*$/ {
      in_metadata = 1
      next
    }

    in_metadata && /^[[:space:]]+name:[[:space:]]*/ {
      value = $0
      sub(/^[[:space:]]*name:[[:space:]]*/, "", value)
      metadata_name = clean(value)
    }

    /^[[:space:]]+activeDeadlineSeconds:[[:space:]]*/ {
      value = $0
      sub(/^[[:space:]]*activeDeadlineSeconds:[[:space:]]*/, "", value)
      active_deadline = clean(value)
    }

    END {
      finish_doc()
      if (!found_migration_job) {
        exit 2
      }
      print observed_active_deadline
    }
  ' "$RENDERED_MANIFEST"
)"; then
  echo "missing migration job in rendered local Kubernetes manifest: modular-backend-lab-migration" >&2
  exit 1
fi

if [[ "$migration_active_deadline" != "900" ]]; then
  echo "migration job activeDeadlineSeconds must be 900, got: ${migration_active_deadline:-<unset>}" >&2
  exit 1
fi

echo "OK: migration job activeDeadlineSeconds is 900"

if ! grep -Eq '^[[:space:]]*MIGRATION_WAIT_TIMEOUT="\$\{K8S_MIGRATION_WAIT_TIMEOUT:-900s\}"[[:space:]]*$' "$K8S_LOCAL_UP_SCRIPT"; then
  echo "scripts/k8s-local-up.sh must default K8S_MIGRATION_WAIT_TIMEOUT to 900s" >&2
  exit 1
fi

echo "OK: scripts/k8s-local-up.sh defaults K8S_MIGRATION_WAIT_TIMEOUT to 900s"
echo "Local Kubernetes static validation passed."
