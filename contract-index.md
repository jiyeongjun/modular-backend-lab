# Contract Index

## Completed Contract

- `contracts/contract-002.md` - Generic settlement module.
- `contracts/contract-001.md` - Event-sourced business ledgers for current domains.

## Current Decision

- Add settlement as a generic operational module, not as ERP/accounting.
- Use `domain_events` as the append-only source-of-truth ledger for stateful business aggregates.
- Keep current state tables as projections/read models for HTTP responses, idempotency lookup, and batch scans.
- Keep `outbox_events` separate as the integration publishing queue; it must not become the event store.
- Apply the ledger pattern to `order`, `payment`, `inventory`, `fulfillment`, `refund`, and
  `settlement`.
- Leave `checkout` as orchestration because it has no persisted aggregate of its own.

## Verification

- `pnpm test:integration` passed with 6 files, 14 tests passed, 6 Docker prerequisite tests skipped.
- `pnpm quality` passed with 32 files, 102 tests passed, 6 Docker prerequisite tests skipped.
- `pnpm test:integration` passed with 5 files, 11 tests passed, 5 Docker prerequisite tests skipped.
- `pnpm quality` passed with 27 files, 85 tests passed, 5 Docker prerequisite tests skipped.
- Repository integration tests inspect `domain_events` for representative aggregate transitions.
