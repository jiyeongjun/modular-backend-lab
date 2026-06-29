# Queue Backend Policy

Model:

```txt
Core processor
  <- QueuePublisher/EventPublisher port
  <- Queue adapter OR event-stream adapter
  <- BullMQ + Valkey OR SQS OR MSK
```

Local default:

```txt
BullMQ + Valkey
```

Cloud production alternative:

```txt
SQS + worker adapter
```

Mature event-driven MSA alternative:

```txt
MSK + event-stream adapter
```

BullMQ runs on Valkey and remains the default local/test runtime. SQS replaces the queue layer for
simple AWS-managed async work. MSK is a managed Kafka-compatible event streaming backbone candidate
for mature event-driven MSA deployments; it is not part of the default local path.

Event sourcing is separate from queue selection. `domain_events` is the source-of-truth ledger,
`outbox_events` is the integration publishing queue, and BullMQ/SQS/MSK are delivery backends behind
ports.

## Current Implementation Boundary

- BullMQ and ioredis imports are allowed only in `src/infra/queue/**` queue adapters and
  `src/workers/**` runtime composition files.
- `src/jobs/**` processors depend on application usecases or publisher/repository ports. They must
  not import BullMQ, ioredis, Redis/Valkey clients, AWS SQS SDKs, Kafka/MSK clients, or local
  `src/infra/queue/**` / `src/infra/event-stream/**` adapter implementations.
- Worker entrypoints parse runtime input such as CLI job names, schedules, or queue messages into a
  job/usecase/processor call. They must not implement domain business rules directly.
- The current outbox publisher scans `outbox_events` through an `AsyncIterable`, publishes through an
  `EventPublisher` port, then marks rows processed after publish. External queue publish must stay
  outside long DB transactions.
- SQS is documented as the AWS-style replacement boundary only. This repository does not currently
  implement an SQS adapter.
- MSK is documented as a future AWS-managed event streaming boundary only. This repository does not
  currently implement an MSK/Kafka adapter, create topics, or provision clusters.
- `scripts/convention-scan.ts` fails when queue/event backend package imports or local queue/event
  adapter imports appear outside the allowed infra/runtime boundary.

## Rules

1. Queue backends are runtime adapters.
2. Core job processors must not import BullMQ.
3. Core job processors must not import AWS SQS SDK.
4. Core job processors must not import Kafka/MSK clients.
5. Core job processors must not import Redis/Valkey clients.
6. Queue and event-stream adapters should implement ports.
7. Valkey is the default local Redis-compatible backend.
8. The default developer path must remain runnable locally without paid managed services.
9. Code should target Redis-compatible protocol, not Valkey-specific APIs, unless documented.
10. SQS visibility timeout, retries, and DLQ behavior must be considered when implementing SQS adapters.
11. MSK topic naming, partition key, schema versioning, retry topics, DLQ topics, consumer groups,
    replay policy, and lag monitoring must be decided before implementing an MSK adapter.
12. BullMQ retry, backoff, repeatable jobs, and job IDs must be configured explicitly.
13. Idempotency is mandatory for queue consumers that can receive duplicates.
14. Queue/event message shape must be stable and versioned where practical.
15. Do not put business rules in queue handlers.
16. Worker handlers should parse message to command to application/job processor.
17. Failed jobs and consumer lag must be observable.
