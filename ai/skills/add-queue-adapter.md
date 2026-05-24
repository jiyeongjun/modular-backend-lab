# Add Queue Adapter

## Purpose

Add or change queue backend integration while preserving core processor independence.

## When To Use

Use for BullMQ, SQS, or another queue backend adapter.

## Required Reading

- `docs/13-queue-backend-policy.md`
- `src/infra/queue/sqs/README.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Keep the core port unchanged where possible.
2. Implement backend code under `src/infra/queue`.
3. Document retry, visibility timeout, DLQ, and idempotency behavior.
4. Add adapter tests if practical.
5. Run convention checks.
6. Validate or narrow external message payloads at the adapter boundary.

## Files Usually Touched

- `src/infra/queue/*`
- `docs/13-queue-backend-policy.md`
- `docs/09-architecture-decisions.md`

## Tests/Checks To Run

- `pnpm typecheck`
- `pnpm conventions:scan`
- `pnpm arch:check`

## Forbidden Patterns

- BullMQ/SQS/Redis imports in domain/application.
- Backend-specific payload assumptions in processors.
- Untyped queue payloads entering application/domain code.

## Definition Of Done

The adapter implements a port, documents delivery guarantees, narrows external payloads, and does not
leak SDK types inward.
