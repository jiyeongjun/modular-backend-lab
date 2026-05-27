# Contract Index

No active contract.

## Current Decision

- Add settlement as a generic operational module, not as ERP/accounting.
- Add promotion as a coupon policy module that can quote, reserve, commit, and release coupon
  redemptions without coupling checkout directly to promotion internals.
- Add small maintenance helpers for module scaffolding, route tests, and outbox inserts without
  creating a backend framework layer.
- Use `domain_events` as the append-only source-of-truth ledger for stateful business aggregates.
- Keep current state tables as projections/read models for HTTP responses, idempotency lookup, and batch scans.
- Keep `outbox_events` separate as the integration publishing queue; it must not become the event store.
- Apply the ledger pattern to `customer`, `order`, `payment`, `inventory`, `fulfillment`, `refund`,
  `settlement`, `promotion`, `returns`, and `notification`.
- Leave `checkout` as orchestration because it has no persisted aggregate of its own.
- Add `returns` as the module that owns return request, RMA authorization, receipt, and inspection
  before any refund/restock orchestration consumes those facts.
- Add `notification` as a generic integration module for request, send, success/failure, and retry
  tracking behind a sender port.
- Add `customer` before auth as the business identity module that owns customer lifecycle and a stable
  `customerId`; email/password login remains a separate future auth module.
