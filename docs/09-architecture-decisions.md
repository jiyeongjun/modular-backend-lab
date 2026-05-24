# Architecture Decisions

## Node.js 24 Active LTS

Node.js 24 is selected for this bootstrap because the local runtime is Node `v24.12.0`, Node 24 is an
LTS line in the official release metadata, and Node 26 is Current in May 2026. The project pins the
major in `.node-version` and `engines`.

## Biome Instead of Prettier or ESLint

Biome is the default formatter and linter. Dependency boundaries belong to dependency-cruiser and the
custom convention scanner.

## BullMQ Locally, SQS in AWS

BullMQ with Valkey is practical for local development. SQS is documented as the recommended managed
AWS queue alternative. Core processors depend only on ports.

## Docker Image Tags

Local compose files use stable version tags instead of `latest`. They are local development defaults,
not production hardening claims.
