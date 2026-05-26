# Event-Sourced Business Ledgers For Current Domains

Status: Completed

## Goal

Rework the currently persisted business domains toward an ERP/accounting-friendly event sourcing
pattern.

## Scope

- Add a `domain_events` table with aggregate stream versioning and append-only semantics.
- Record domain events for order, payment, inventory, fulfillment, and refund state changes.
- Keep current tables as projections/read models updated in the same transaction.
- Keep outbox writes in the same transaction but separate from the event store.
- Update README Korean and English docs to explain event sourcing and ERP/accounting intent.

## Non-Goals

- Do not turn `outbox_events` into the event store.
- Do not event-source `checkout`; it remains application orchestration.
- Do not add a new framework, effect system, ORM, or message broker.
- Do not build a full ERP/accounting module in this contract.

## Completion Criteria

- Each persisted domain state transition appends domain events before or with projection updates.
- Projection version tracks the applied aggregate event stream version.
- Integration coverage proves representative rows are written to `domain_events`.
- README documents source-of-truth events, projections, outbox separation, and ERP/accounting usage.
- `pnpm quality` passes.

## Verification Result

- `pnpm test:integration`: 5 files passed, 11 tests passed, 5 Docker prerequisite tests skipped.
- `pnpm quality`: 27 files passed, 85 tests passed, 5 Docker prerequisite tests skipped.
