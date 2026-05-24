# Copilot Instructions

Follow `AGENTS.md`.

- Keep domain/application portable.
- Do not leak Hono, Kysely, Zod schemas, BullMQ, SQS, Valkey/Redis clients, or OpenTelemetry SDKs into core logic.
- Use existing module patterns before inventing new ones.
- Preserve strict TypeScript and compile-time guarantees.
- Do not use `any`, `as any`, broad casts, or non-null assertions to bypass the compiler.
- Use risk-based tests focused on observable behavior.
- Run quality gates before considering work complete.
