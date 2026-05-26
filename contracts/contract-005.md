---
task: "Add checkout orchestration module across order, inventory, and payment"
status: "done"
knowns:
  - "Checkout should demonstrate cross-module workflow without importing another module's infra or http layer."
  - "Existing order, inventory, and payment modules expose usecases that can be adapted behind checkout ports."
  - "The checkout workflow should avoid holding DB transactions around Toss Payments calls."
unknowns:
  - "No durable checkout process table is being added in this step."
next_step: "Hand off final results."
updated_at: "2026-05-26T05:08:00.000Z"
---

## Inputs

- User request to implement the recommended next module.
- Existing `order`, `inventory`, and `payment` modules.
- Architecture rules in `AGENTS.md` and module playbooks.

## Completion Criteria

- `src/modules/checkout` exists with domain, application, ports, infra adapters, HTTP routes, and tests.
- Checkout application depends on checkout ports, not concrete order/inventory/payment implementations.
- Cross-module adapters call existing application usecases without importing another module's `infra` or `http`.
- Order module exposes a payment preflight validation usecase so checkout can reject bad orders before reserving inventory or confirming payment.
- Checkout flow validates order, reserves inventory, confirms payment, commits inventory, then marks order paid.
- Expected failures return `Result` and include explicit compensation outcomes where payment or inventory has already changed.
- HTTP route validates input with Zod and maps expected results to stable responses.
- README module list reflects `checkout`.
- `pnpm quality` passes.

## Mutation Plan

- Add order validation usecase and tests.
- Add checkout domain result/error/compensation types.
- Add checkout ports for order, inventory, and payment collaboration.
- Add checkout submit usecase with bounded orchestration and compensation attempts.
- Add adapters from checkout ports to existing module usecases.
- Add checkout HTTP route/schema/response and wire app/main.
- Update route tests that build `createApp`.
- Update README docs and run quality gates.

## Verification

- `pnpm typecheck`
- `pnpm check`
- `pnpm test`
- `pnpm arch:check`
- `pnpm conventions:scan`
- `pnpm build`

## Work Log

- Contract aligned.
- Added order checkout validation usecase.
- Implemented checkout domain, ports, application orchestration, adapters, HTTP route, tests, and docs.
- Ran `pnpm quality` successfully.

## Result

- Done. Checkout orchestration module is implemented and quality gates pass.
