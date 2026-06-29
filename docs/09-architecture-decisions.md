# Architecture Decisions

## Node.js 24 Active LTS

Node.js 24 is selected for this bootstrap because the local runtime is Node `v24.12.0`, Node 24 is an
LTS line in the official release metadata, and Node 26 is Current in May 2026. The project pins the
major in `.node-version` and `engines`.

## Biome Instead of Prettier or ESLint

Biome is the default formatter and linter. Dependency boundaries belong to dependency-cruiser and the
custom convention scanner.

## BullMQ Locally, SQS Or MSK In AWS

BullMQ with Valkey is the default because it is practical for local development and local kind
verification. SQS is documented as the simple managed AWS queue alternative. MSK is documented as the
managed Kafka-compatible event streaming backbone candidate for mature event-driven MSA deployments.
Core processors depend only on ports.

## Docker Image Tags

Local compose files use stable version tags instead of `latest`. They are local development defaults,
not production hardening claims.
