# Add Queue Adapter

## Purpose

Add or change queue backend integration while preserving core processor independence.

## When To Use

Use for BullMQ, SQS, MSK/Kafka, or another queue/event backend adapter.

## Required Reading

- `docs/13-queue-backend-policy.md`
- `docs/21-event-contract-and-topic-policy.md`
- `src/infra/queue/sqs/README.md`
- `src/infra/event-stream/msk/README.md` when the target is MSK/Kafka
- `docs/18-type-safety-policy.md`

## Steps

1. Keep the core port unchanged where possible.
2. Implement queue backend code under `src/infra/queue`; implement event-stream backend code under
   `src/infra/event-stream`.
3. Document retry, visibility timeout, DLQ, idempotency, topic, partition, consumer group, and replay
   behavior as relevant.
4. Add adapter tests if practical.
5. Run convention checks.
6. Validate or narrow external message payloads at the adapter boundary.

## Files Usually Touched

- `src/infra/queue/*`
- `src/infra/event-stream/*`
- `docs/13-queue-backend-policy.md`
- `docs/09-architecture-decisions.md`

## Tests/Checks To Run

- `pnpm typecheck`
- `pnpm conventions:scan`
- `pnpm arch:check`

## Forbidden Patterns

- BullMQ/SQS/Kafka/Redis imports in domain/application.
- Backend-specific payload assumptions in processors.
- Untyped queue payloads entering application/domain code.

## Definition Of Done

The adapter implements a port, documents delivery guarantees, narrows external payloads, and does not
leak SDK types inward.
