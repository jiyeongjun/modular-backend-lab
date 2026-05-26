---
task: "Add fulfillment and shipping module after checkout"
status: "done"
knowns:
  - "Checkout already completes order validation, inventory reservation/commit, payment confirmation, and order payment."
  - "Fulfillment should demonstrate post-payment operational state without importing another module's infra or http layer."
  - "Shipping carrier integration must be behind a port and must not leak provider concerns into domain/application code."
unknowns:
  - "No real carrier provider credentials or sandbox API are being added in this step."
next_step: "Hand off final results."
updated_at: "2026-05-26T06:01:10.000Z"
---

## Inputs

- User request to implement the recommended next module.
- Existing `order`, `inventory`, `payment`, and `checkout` modules.
- Architecture rules in `AGENTS.md` and module playbooks.

## Completion Criteria

- `src/modules/fulfillment` exists with domain, application, ports, infra, HTTP routes, and tests.
- Fulfillment domain models shipment state with discriminated unions and pure transition functions.
- Fulfillment usecases return `Result` for expected business failures.
- Carrier interaction is represented by a `ShippingCarrier` port and invoked outside DB transactions.
- Persistence uses Kysely only in infra with explicit row/domain mapping and migration types.
- A scheduler-independent job syncs shipment statuses using `AsyncIterable` and bounded behavior.
- HTTP routes validate input with Zod and map expected outcomes to stable responses.
- App composition wires fulfillment routes and usecases without cross-module infra/http imports.
- README module list reflects `fulfillment`.
- `pnpm quality` passes.

## Mutation Plan

- Add fulfillment domain shipment states, errors, events, and behavior tests.
- Add application usecases for creating fulfillments, marking packed, purchasing labels, and syncing carrier status.
- Add ports for fulfillment repository, unit of work, outbox, and shipping carrier.
- Add Kysely migration, database table types, mapper, repository, unit of work, outbox repository, and fake/local carrier adapter.
- Add HTTP schemas, response mapping, routes, and route tests.
- Add scheduler-independent status sync job with tests.
- Wire app/main composition and update README docs.
- Run quality gates and close the contract.

## Verification

- `pnpm typecheck`
- `pnpm check`
- `pnpm test`
- `pnpm arch:check`
- `pnpm conventions:scan`
- `pnpm build`

## Work Log

- Contract aligned.
- Added fulfillment domain states, transitions, errors, and events.
- Added application usecases for create, pack, label purchase, cancel, single status sync, and batch status sync.
- Added fulfillment ports, Kysely persistence, migration, mapper, outbox repository, UnitOfWork, and local shipping carrier adapter.
- Added HTTP routes, status sync job, worker wiring, app composition, README updates, and tests.
- Ran `pnpm quality` successfully.

## Result

- Done. Fulfillment/shipping module is implemented and quality gates pass.
