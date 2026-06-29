#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "EKS preflight failed: $*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
  fi
}

validate_region_format() {
  local region="$1"

  if [[ ! "$region" =~ ^[a-z]{2}(-[a-z]+)+-[0-9]+$ ]]; then
    fail "invalid AWS region format: $region"
  fi
}

resolve_region() {
  local configured_region

  if [[ -n "${AWS_REGION:-}" ]]; then
    printf '%s\n' "$AWS_REGION"
    return 0
  fi

  if [[ -n "${AWS_DEFAULT_REGION:-}" ]]; then
    printf '%s\n' "$AWS_DEFAULT_REGION"
    return 0
  fi

  configured_region="$(aws configure get region 2>/dev/null || true)"
  if [[ -n "$configured_region" ]]; then
    printf '%s\n' "$configured_region"
    return 0
  fi

  return 1
}

validate_optional_account_id() {
  local expected_account_id="$1"
  local actual_account_id="$2"

  if [[ ! "$expected_account_id" =~ ^[0-9]{12}$ ]]; then
    fail "AWS_ACCOUNT_ID must be a 12-digit AWS account ID, got: $expected_account_id"
  fi

  if [[ "$expected_account_id" != "$actual_account_id" ]]; then
    fail "AWS_ACCOUNT_ID ($expected_account_id) does not match current caller account ($actual_account_id)"
  fi
}

validate_optional_ecr_repository() {
  local repository="$1"

  if [[ ! "$repository" =~ ^[a-z0-9]+([._/-][a-z0-9]+)*$ ]]; then
    fail "ECR_REPOSITORY must look like an ECR repository name, got: $repository"
  fi
}

require_command aws
require_command kubectl

if [[ -n "${AWS_REGION:-}" && -n "${AWS_DEFAULT_REGION:-}" && "$AWS_REGION" != "$AWS_DEFAULT_REGION" ]]; then
  fail "AWS_REGION ($AWS_REGION) and AWS_DEFAULT_REGION ($AWS_DEFAULT_REGION) must not conflict"
fi

region="$(resolve_region)" || fail "missing AWS region. Set AWS_REGION or AWS_DEFAULT_REGION, or configure an AWS CLI default region."
validate_region_format "$region"

echo "aws CLI: $(command -v aws)"
echo "kubectl: $(command -v kubectl)"
echo "AWS region: $region"

echo "AWS caller identity:"
if ! aws sts get-caller-identity --region "$region" --output json; then
  fail "unable to read AWS caller identity. Check AWS CLI credentials, SSO/session login, and account access."
fi

caller_account_id="$(
  aws sts get-caller-identity \
    --region "$region" \
    --query Account \
    --output text 2>/dev/null
)" || fail "unable to read AWS caller account ID"

if [[ -n "${AWS_ACCOUNT_ID:-}" ]]; then
  validate_optional_account_id "$AWS_ACCOUNT_ID" "$caller_account_id"
  echo "OK: AWS_ACCOUNT_ID matches current caller account"
else
  echo "Optional AWS_ACCOUNT_ID not set; current caller account is $caller_account_id"
fi

if [[ -n "${ECR_REPOSITORY:-}" ]]; then
  validate_optional_ecr_repository "$ECR_REPOSITORY"
  echo "OK: ECR_REPOSITORY value looks valid"
else
  echo "Optional ECR_REPOSITORY not set"
fi

echo "EKS preflight passed. No AWS or Kubernetes resources were created, modified, or deleted."
