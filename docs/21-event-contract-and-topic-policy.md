# Event Contract And Topic Policy

This document defines the contract boundary for domain events, outbox events, queue messages, and
future event-stream topic events. It does not add Kafka/MSK, SQS, BullMQ, Terraform, Helm, CDK,
Pulumi, EKS, or topic resources.

The goal is to make later queue or event-stream adapters replaceable without changing domain or
application code.

## Source Of Truth

`domain_events` is the append-only source-of-truth ledger for business state changes. It is the
reference for event sourcing, audit reconstruction, aggregate replay, and rebuilding projections.

`outbox_events` is not the event store. It is an integration publishing queue used to isolate
external delivery failure and retry from the transaction that changed business state. Outbox rows may
carry a publishable envelope or enough data for an adapter to build one, but the source of business
truth remains `domain_events`.

BullMQ, SQS, and MSK are delivery backends. They may carry a copy of an event or command-shaped
message for consumers, but they are not the authoritative ledger. If delivery state and
`domain_events` disagree, `domain_events` wins and the adapter or projection must be repaired from
the ledger.

## Event Kinds

Use the same conceptual envelope across backends, while keeping each layer's ownership clear:

- Domain event: a pure business fact returned by domain/application logic and persisted to
  `domain_events`.
- Outbox event: a publish work item written in the same short transaction as the domain event and
  projection update.
- SQS message: a delivery message consumed by one worker flow with visibility timeout, retries, and
  DLQ behavior.
- MSK topic event: a retained stream record consumed by one or more consumer groups with partition
  ordering, lag monitoring, and replay semantics.

Adapter code may translate between these shapes at the boundary. Translation must not require
domain/application code to import queue SDKs, Kafka/MSK clients, Redis/Valkey clients, or backend
implementation types.

## Event Envelope

Use these fields for publishable integration events unless a documented adapter-specific reason
exists:

| Field | Required | Purpose |
| --- | --- | --- |
| `eventId` | yes | Globally unique event identifier for deduplication and tracing. |
| `eventType` | yes | Stable past-tense business fact name such as `OrderPaid`. |
| `eventVersion` | yes | Contract version for the event payload. |
| `aggregateType` | yes | Owning aggregate or module concept, such as `Order` or `Payment`. |
| `aggregateId` | yes | Aggregate identifier used for consistency and common ordering scopes. |
| `occurredAt` | yes | Business event time in ISO 8601 UTC format. |
| `producer` | yes | Producing module or runtime boundary, such as `order` or `outbox-publisher`. |
| `correlationId` | yes | Request or workflow identifier tying related work together. |
| `causationId` | yes | Event, command, message, or request that caused this event. |
| `idempotencyKey` | yes | Stable key consumers can use to make handling repeat-safe. |
| `payload` | yes | Versioned event data. This is the external contract. |
| `metadata` | no | Non-business delivery, trace, tenant, schema, or retention hints. |

`payload` must not be a raw DB row, ORM/Kysely shape, HTTP DTO, or internal table dump. Map rows and
commands into explicit event payloads.

## Event Type Naming

`eventType` names a business fact that already happened.

Preferred examples:

- `OrderPaid`
- `PaymentConfirmed`
- `InventoryReserved`
- `RefundCompleted`
- `SupportTicketAssigned`

Rules:

1. Use PascalCase past-tense business facts.
2. Do not use command names such as `PayOrder` or `ReserveInventory`.
3. Do not use handler, job, queue, route, or adapter names as event types.
4. Keep the name independent from the delivery backend.
5. Prefer one clear fact over a generic event such as `OrderUpdated`.

## Versioning

`eventVersion` is part of the consumer contract.

- Additive payload changes may keep the same major version when existing consumers can ignore the new
  optional field.
- Breaking changes require a new major version or a new event type.
- Consumers must ignore optional fields they do not understand.
- Producers must not silently change field meaning, units, enum semantics, identifier format, or
  nullability under the same version.
- When a topic or queue name includes a version, it should represent the stream contract major
  version, not every small payload addition.

Breaking changes include removing a field, renaming a field, changing a field type, changing money or
quantity units, narrowing enum values, changing timestamp meaning, or changing the routing key
semantics.

## Topic And Message Naming

Topic and queue names are delivery contracts, not domain model names. The logical contract name
should be stable, lowercase, and backend-neutral where practical.

Recommended logical names:

```txt
<domain>.events.v<major>
<domain>.events.v<major>.retry
<domain>.events.v<major>.dlq
```

Examples:

```txt
order.events.v1
payment.events.v1
inventory.events.v1
```

Cloud resource names may add environment, region, or account prefixes, but the logical contract name
should stay recognizable. Backend adapters may translate separators to the resource provider's
allowed character set, such as `order-events-v1` for an SQS queue. Do not name topics or queues after
commands, handlers, worker classes, HTTP routes, or implementation details.

Avoid one topic per event type by default. Split streams only when ownership, retention, access
control, throughput, partitioning, replay, or consumer isolation requires it.

## Partition And Routing Keys

The routing or partition key defines the ordering scope. Choose it deliberately and document the
reason in the adapter or module policy.

- Use `aggregateId` when aggregate consistency and per-aggregate ordering matter.
- Use `customerId` when a customer timeline is the primary ordering concern.
- Use `orderId` when order workflow ordering across payment, inventory, fulfillment, refund, and
  settlement is the primary concern.

Do not use a random key when ordering or deduplication is expected. Do not use a hot key such as a
constant domain name for high-volume event streams.

If different consumers need incompatible ordering scopes, keep the source ledger stable and add an
explicit projection, fan-out adapter, or separate stream with documented tradeoffs.

## SQS And MSK Semantics

SQS is queue delivery. Design around visibility timeout, at-least-once delivery, retries, a DLQ, and
worker throughput. A message is normally consumed by one worker flow, and replay usually means
redriving messages or republishing from a ledger.

MSK is topic and partition based event streaming. Design around partitions, consumer groups,
retention, replay, lag monitoring, retry topics, and dead-letter topics. Multiple independent
consumer groups can consume the same event stream without changing the producer contract.

BullMQ remains the default local/test runtime on Valkey. It is also a delivery backend, not the event
ledger.

All three paths require idempotent consumers because duplicate delivery can happen.

## Retry, DLQ, And Replay

SQS adapters must define:

- Visibility timeout relative to normal and worst-case handler duration.
- Retry count or redrive behavior.
- DLQ name and ownership.
- Idempotency key and duplicate handling.

MSK adapters must define:

- Main topic name.
- Retry topic policy, including delay strategy if used.
- Dead-letter topic name and payload shape.
- Consumer group naming.
- Replay policy and expected lag monitoring.

Replay policy must state the source:

- Ledger replay: rebuild or republish from `domain_events`, the business source of truth.
- Stream replay: reprocess records still available inside stream retention.

Use ledger replay when business reconstruction or projection rebuild correctness matters. Use stream
replay only when retention, schema compatibility, and consumer behavior are sufficient for the
incident being handled.

## Consumer Rules

Consumers must not depend on internal table structures, Kysely row types, or domain module internals
from another module. Event payloads are external contracts and need the same care as HTTP or webhook
contracts.

Consumer rules:

1. Validate and narrow message payloads at the adapter boundary.
2. Convert validated payloads into plain command objects before application usecases.
3. Keep handling idempotent through `eventId`, `idempotencyKey`, or a consumer-owned processed-event
   record.
4. Treat unknown optional fields as ignorable.
5. Treat unknown event types or unsupported versions as a controlled adapter failure, not as domain
   logic.
6. Do not put business rules in queue handlers or stream consumers; call application usecases or jobs.

## Security And Privacy

Event payloads can be retained, replayed, copied to DLQs, inspected in logs, or consumed by multiple
systems. Keep them intentionally small.

- Never include secrets, tokens, passwords, raw credentials, private keys, session cookies, or full
  authorization headers.
- Minimize PII. Prefer stable identifiers and snapshots that are necessary for the consumer's job.
- If PII is required, document the field, reason, retention expectation, access boundary, and deletion
  or redaction strategy.
- Do not log full event payloads by default. Log identifiers, event type, version, producer,
  correlation id, and failure class.
- Metadata must not become a hiding place for secrets or unbounded personal data.

## Adapter Readiness Checklist

Before adding or changing a delivery adapter, document:

- Event envelope fields and payload version.
- Logical topic or queue name.
- Routing or partition key and ordering scope.
- Retry, DLQ, and replay policy.
- Consumer group or worker ownership.
- Idempotency strategy.
- Boundary validation and narrowing.
- Security and PII handling.
- Observability signals for publish failures, consumer failures, DLQ count, and lag where relevant.

This checklist is documentation only until an adapter is intentionally implemented.
