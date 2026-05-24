# Dependency Rules

- Domain must not import Hono, Kysely, Zod, Pino, BullMQ, SQS SDKs, Redis clients, or telemetry SDKs.
- Application must not import Hono, Kysely, queue SDKs, worker runtimes, or telemetry SDKs.
- Ports describe behavior without depending on concrete adapters.
- Infrastructure implements ports and maps rows/events explicitly.
- HTTP reads and validates transport input, calls usecases, and maps results to responses.
- Jobs process application-level work without importing HTTP.
- Workers schedule or trigger jobs and contain no business rules.

`dependency-cruiser` enforces import direction. `scripts/convention-scan.ts` catches local patterns
that are easier to express as a small scanner.
