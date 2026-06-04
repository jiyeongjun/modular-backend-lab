# Queue Backend Policy

Model:

```txt
Core processor
  <- QueuePublisher/EventPublisher port
  <- Queue adapter
  <- BullMQ + Valkey OR SQS
```

Local default:

```txt
BullMQ + Valkey
```

Cloud production alternative:

```txt
SQS + worker adapter
```

BullMQ runs on Valkey. SQS replaces the queue layer itself.

## Current Implementation Boundary

- BullMQ and ioredis imports are allowed only in `src/infra/queue/**` queue adapters and
  `src/workers/**` runtime composition files.
- `src/jobs/**` processors depend on application usecases or publisher/repository ports. They must
  not import BullMQ, ioredis, Redis/Valkey clients, AWS SQS SDKs, or local `src/infra/queue/**`
  adapter implementations.
- Worker entrypoints parse runtime input such as CLI job names, schedules, or queue messages into a
  job/usecase/processor call. They must not implement domain business rules directly.
- The current outbox publisher scans `outbox_events` through an `AsyncIterable`, publishes through an
  `EventPublisher` port, then marks rows processed after publish. External queue publish must stay
  outside long DB transactions.
- SQS is documented as the AWS-style replacement boundary only. This repository does not currently
  implement an SQS adapter.
- `scripts/convention-scan.ts` fails when queue backend package imports or local queue adapter
  imports appear outside the allowed queue/runtime boundary.

## Rules

1. Queue backends are runtime adapters.
2. Core job processors must not import BullMQ.
3. Core job processors must not import AWS SQS SDK.
4. Core job processors must not import Redis/Valkey clients.
5. Queue adapters should implement ports.
6. Valkey is the default local Redis-compatible backend.
7. Code should target Redis-compatible protocol, not Valkey-specific APIs, unless documented.
8. SQS visibility timeout, retries, and DLQ behavior must be considered when implementing SQS adapters.
9. BullMQ retry, backoff, repeatable jobs, and job IDs must be configured explicitly.
10. Idempotency is mandatory for queue consumers that can receive duplicates.
11. Queue message shape must be stable and versioned where practical.
12. Do not put business rules in queue handlers.
13. Worker handlers should parse message to command to application/job processor.
14. Failed jobs must be observable.
