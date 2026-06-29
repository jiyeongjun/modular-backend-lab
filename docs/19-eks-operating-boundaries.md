# EKS Operating Boundaries

This document describes how the current Kubernetes shape can move toward EKS without claiming that
EKS support is implemented in this repository.

## Scope

This repository currently provides:

- Reusable Kubernetes app/runtime manifests under `deploy/k8s/base/`.
- A kind-only local overlay under `deploy/k8s/local/`.
- Static local Kubernetes validation through `pnpm k8s:validate`.

This repository does not create EKS resources, Terraform modules, Helm releases, IRSA manifests, ALB
Ingress manifests, RDS instances, SQS queues, MSK clusters/topics, VPC resources, or AWS Secrets
Manager/SSM resources. An EKS overlay would be a future deployment artifact, not something
represented by the current manifest set.

## Current Kubernetes Shape

`deploy/k8s/base/` is the app/runtime shape:

- API `Service` and `Deployment`.
- Worker `Deployment`.
- Scheduler `Deployment`.
- Migration `Job`.
- Shared runtime `ConfigMap`.

The base keeps the process layout, probes where the runtime exposes HTTP, resources, security
contexts, rollout defaults, and app labels in one reusable place. It is still only a baseline. An EKS
overlay should patch environment values, image source, replica counts, service accounts, and runtime
settings instead of treating every local default as production policy.

`deploy/k8s/local/` is the kind-only overlay:

- Local namespace.
- Non-sensitive `secrets.example.yaml`.
- In-cluster Postgres with disposable `emptyDir` storage.
- In-cluster Valkey with disposable `emptyDir` storage.
- Local observability stack for Prometheus, Grafana, Tempo, Loki, Alloy, and kube-state-metrics.
- kind cluster config and local image tag wiring.

The local overlay exists to make the app/runtime shape runnable on a developer machine. It is not an
EKS environment.

## EKS Overlay Separation

If an EKS overlay is added later, keep local-only concerns out of it:

- Do not carry `deploy/k8s/local/secrets.example.yaml` into EKS. Use a secret delivery mechanism.
- Do not carry local Postgres into EKS. Use RDS or another managed PostgreSQL endpoint.
- Do not carry local Valkey when the chosen AWS backend is SQS or MSK. Use an SQS queue adapter for
  simple async work, or an MSK event-stream adapter when event backbone semantics are required.
- Do not carry the kind cluster config.
- Do not assume local `emptyDir` volumes are data persistence.
- Do not assume the local observability stack is the operational observability stack.
- Do not reuse the local image tag as a deployable image reference.

An EKS overlay should make environment-specific decisions explicit: namespace ownership, image
registry and tag, secret delivery, service accounts, workload identity, ingress class, TLS, replica
counts, resource sizing, observability export, and scaling policy.

## Adapter Boundary Mapping

| Current local boundary | EKS-style replacement | Boundary rule |
| --- | --- | --- |
| In-cluster Postgres deployment | RDS PostgreSQL endpoint | Application code sees repository ports. Only the config/infra boundary reads `DATABASE_URL`, and Kysely remains an infra persistence adapter. |
| BullMQ plus local Valkey | SQS queue adapter or MSK event-stream adapter | Core processors depend on queue/event publisher ports and must not import BullMQ, SQS SDKs, Kafka/MSK clients, Redis, or Valkey clients. |
| Local Kubernetes Secret example | Secrets Manager, SSM Parameter Store, External Secrets, CSI driver, or another secret delivery path | Application code sees validated environment/config values, not the secret backend. |
| Static AWS credentials in env or secrets | IRSA/workload identity | AWS access belongs to adapter/runtime code through pod identity, not long-lived credentials in Kubernetes Secrets. |
| Local service access | ALB Ingress Controller or another ingress controller | Hono remains a delivery adapter behind the ingress path. Application/domain code does not know load balancers, TLS, or ingress annotations. |
| Local Prometheus/Grafana/Tempo/Loki stack | Managed observability or an explicitly operated in-cluster stack | OpenTelemetry, logs, metrics, and dashboards remain runtime observability concerns outside domain/application code. |

## Persistence

The local overlay runs Postgres inside Kubernetes so the kind baseline is self-contained. For EKS,
that should be replaced by RDS or an equivalent managed PostgreSQL service. The app/runtime boundary
is the configured database URL and repository ports:

- `DATABASE_URL` is delivered through the environment/config boundary.
- Kysely stays in infrastructure persistence code.
- DB rows continue to be mapped explicitly to domain models.
- Domain and application code do not know whether PostgreSQL is local, RDS, or another managed
  endpoint.

Migration execution remains a deployment decision. The existing migration `Job` describes the
runtime shape, but the EKS workflow must decide when it is safe to run migrations, what credentials
are used, and how failures are handled.

## Queue And Event Streaming

The local baseline uses BullMQ with Valkey because it is practical for kind and keeps the default
developer path runnable without paid managed services. AWS-style deployments can choose between
different async backends:

- Use SQS when the requirement is simple managed queue delivery, retries, visibility timeout, and
  DLQ-based worker processing.
- Use MSK when the system has matured into event-driven MSA needs: multiple independent consumer
  groups, replay from retained streams, topic/partition design, schema versioning, and consumer lag
  operations.

- Queue backend selection stays behind publisher/consumer ports.
- Worker handlers parse external queue or stream messages into commands for application/job
  processors.
- Core processors do not import queue SDKs, Kafka/MSK clients, or Redis-compatible clients.
- SQS visibility timeout, retries, DLQ behavior, and duplicate delivery idempotency must be decided
  before using SQS operationally.
- MSK topic naming, partition keys, schema versioning, retry/dead-letter topics, consumer groups,
  replay policy, and lag monitoring must be decided before using MSK operationally.

This repository documents the SQS and MSK adapter boundaries but does not create SQS queues, MSK
clusters/topics, or IAM policies.

## Secrets And AWS Access

`deploy/k8s/local/secrets.example.yaml` is a kind convenience file with non-sensitive defaults. For
EKS, use a secret delivery path such as AWS Secrets Manager, SSM Parameter Store, External Secrets,
or a CSI driver integration.

Pods that call AWS APIs should use IRSA or an equivalent workload identity mechanism. Do not model
long-lived AWS access keys as static Kubernetes Secret values for application pods. AWS SDK usage
belongs in adapter/runtime code that already owns the external integration.

## Ingress

The current base exposes an internal Kubernetes `Service` for the API. An EKS overlay may put that
service behind the AWS Load Balancer Controller with ALB Ingress, or behind another ingress
controller. The ingress choice must stay outside Hono, application usecases, and domain logic.

The overlay should decide hostnames, TLS, health check path, ingress class, annotations, and any
load-balancer-specific behavior. This repository does not include those manifests.

## Scaling And Network Policy

Do not add HPA only because EKS is the target. Add HPA after choosing:

- metrics-server or a managed/custom metrics path,
- the SLO or load target that should drive scaling,
- API, worker, and scheduler scaling semantics,
- queue idempotency and duplicate-processing behavior for worker scale-out.

Do not add NetworkPolicy until actual CNI enforcement is confirmed for the cluster. After that,
policy should restrict only known flows: namespace-to-namespace traffic, API to database, workers to
queue/database, runtime pods to observability endpoints, and required DNS or cloud metadata paths.

Schedulers and singleton workers need explicit operational decisions before scaling. The local
baseline uses singleton runtimes and `Recreate` rollout for worker and scheduler processes to avoid
duplicate execution in kind.

## Observability

OpenTelemetry, Prometheus, Grafana, Tempo, Loki, and Alloy are runtime observability concerns. They
must not leak into domain or application logic.

For EKS, the local observability stack may be replaced by managed observability or by an explicitly
operated in-cluster stack. Keep the boundary the same:

- Runtime pods emit JSON logs and OpenTelemetry signals from adapter/runtime layers.
- Export endpoints and collector choices are environment configuration.
- Domain/application code does not import telemetry SDKs.
- Secret values and high-cardinality labels stay out of logs and metrics.

## Operational Readiness Questions

Before treating an EKS overlay as deployable, answer these outside the current repository scope:

- What image registry, tag policy, and rollout process are used?
- How are `DATABASE_URL` and other secrets delivered and rotated?
- Which database endpoint is used, and how are migrations approved and rolled back?
- Which async backend is selected: SQS for simple managed queue delivery, or MSK for event streaming?
  What are its retry, DLQ, visibility timeout, partition, replay, lag, and idempotency rules?
- Which service accounts use workload identity, and which AWS permissions do they have?
- Which ingress controller owns external traffic, TLS, and health checks?
- Which metrics drive HPA, and what SLO or load target justifies the thresholds?
- Which CNI enforces NetworkPolicy, and which namespace, DB, queue, and observability flows are
  allowed?
- Which observability backend receives logs, metrics, and traces?

These are operating decisions. They should be documented in the EKS overlay or platform runbook when
that overlay exists.
