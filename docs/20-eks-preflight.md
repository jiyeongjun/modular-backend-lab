# EKS Preflight

This document is the preflight checklist for moving from the local kind baseline toward EKS. It does
not make EKS deployable by itself.

## Scope

This repository does not currently provide:

- EKS resources.
- Terraform, Helm, CDK, or Pulumi definitions.
- EKS overlays.
- ECR repositories.
- RDS PostgreSQL instances.
- SQS queues.
- IAM roles, IRSA manifests, or workload identity bindings.
- ALB Ingress Controller manifests.
- Secrets Manager, SSM Parameter Store, External Secrets, or CSI driver resources.

The current Kubernetes assets are still the reusable app/runtime base and the kind-only local
baseline. Any EKS implementation should be added later as a separate deployment artifact after the
operating decisions below are made.

## Local Kind Baseline Versus EKS

`deploy/k8s/base/` describes the portable runtime shape: API, worker, scheduler, migration job, and
shared runtime config. `deploy/k8s/local/` makes that shape runnable in kind by adding disposable
local infrastructure.

The local kind baseline includes:

- Local namespace ownership.
- In-cluster Postgres with disposable storage.
- In-cluster Valkey for BullMQ.
- Non-sensitive Kubernetes secret examples.
- Local observability services.
- Local image tag wiring.
- kind cluster configuration.

An EKS environment must replace or explicitly own those choices:

- PostgreSQL should be an RDS endpoint or another managed PostgreSQL endpoint.
- Queue infrastructure may stay on BullMQ only if a Redis-compatible service is chosen; otherwise an
  SQS adapter must be introduced behind the queue ports.
- Secrets should come from a production secret delivery path, not the local example Secret.
- Images should be pulled from ECR or another approved registry with a defined tag policy.
- AWS access should use IRSA or another workload identity mechanism.
- Ingress, TLS, DNS, scaling, network policy, and observability export are platform decisions.

## Decisions Required Before EKS

Decide and document these before adding EKS manifests or infrastructure code:

- **AWS account and region**: target account ID, region, ownership, and access path.
- **ECR repository**: repository name, lifecycle policy owner, and image publishing process.
- **Image tag strategy**: immutable tags, digest pinning expectations, promotion rules, and rollback
  tags.
- **RDS PostgreSQL endpoint**: endpoint ownership, connectivity, TLS requirements, migration
  credentials, and whether migrations run as a Kubernetes Job, CI/CD step, or controlled operator
  action.
- **Migration job authority and rollback criteria**: who can run migrations, when they run relative
  to app rollout, what failure stops rollout, and which schema/data changes require a rollback plan.
- **Secret delivery**: Secrets Manager, SSM Parameter Store, External Secrets, CSI driver, or another
  delivery mechanism; also decide rotation and pod reload behavior.
- **Queue backend**: whether to introduce an SQS adapter, queue names, DLQ names, visibility timeout,
  retry policy, duplicate handling, and idempotency keys.
- **Workload identity**: IRSA or another workload identity method, service account names, role
  ownership, and least-privilege permissions.
- **Ingress controller**: ALB Ingress Controller or another controller, ingress class, hostnames,
  TLS source, health checks, and load balancer annotations.
- **HPA metrics**: metrics-server, managed metrics, or custom metrics source; CPU, memory, request,
  or queue-depth thresholds; and separate policies for API, worker, and scheduler runtimes.
- **NetworkPolicy and CNI policy**: whether the selected CNI enforces NetworkPolicy, required egress
  paths, namespace boundaries, DNS access, database access, queue access, and observability egress.
- **Logs, metrics, and traces**: export path for application logs, Prometheus-style metrics, OTLP
  traces/metrics, dashboards, alert ownership, and retention.

## Adapter Boundary

EKS-specific details stay outside the portable core:

- Domain and application code must not import AWS SDKs, queue SDKs, telemetry SDKs, ingress-specific
  packages, Kubernetes clients, or infrastructure implementations.
- Domain logic remains pure and does not know where PostgreSQL, queues, secrets, logs, metrics, or
  traces are hosted.
- Application usecases depend on repository, unit-of-work, queue, and external-service ports.
- AWS SDK usage belongs only in infra, composition, runtime, worker, or deployment-adapter code that
  owns the external integration.
- Queue backend selection belongs behind queue publisher/consumer ports.
- Telemetry export details belong in runtime observability configuration and instrumentation
  boundaries, not domain/application logic.
- Ingress and load-balancer details belong to Kubernetes/platform configuration. Hono remains the
  HTTP delivery adapter.

## Minimal Read-Only Script

`scripts/eks-preflight.sh` is a local prerequisite check, not a deployment tool. It performs only
read-only checks:

- Confirms `aws` CLI is installed.
- Confirms `kubectl` is installed.
- Resolves the AWS region from `AWS_REGION`, `AWS_DEFAULT_REGION`, or AWS CLI config.
- Prints the current AWS caller identity through STS.
- Validates optional environment variables when present:
  - `AWS_ACCOUNT_ID` must be a 12-digit account ID and must match the STS caller account.
  - `AWS_REGION` and `AWS_DEFAULT_REGION` must not conflict.
  - `ECR_REPOSITORY` must look like an ECR repository name.

Run it with:

```bash
pnpm eks:preflight
```

The script does not create, update, or delete AWS resources or Kubernetes resources. It also does not
prove that ECR, RDS, SQS, IAM, ingress, secrets, HPA, NetworkPolicy, or observability resources exist.
Those checks belong in the future EKS deployment/runbook once those resources are intentionally
defined.

## Preflight Outcome

Passing preflight means the local operator has the minimum CLI/account/region context needed to
continue EKS planning. It does not mean this repository is ready to deploy to EKS.

Failing preflight should be treated as a missing prerequisite. Fix the reported CLI, credential,
region, or environment variable issue before adding EKS manifests or infrastructure automation.
