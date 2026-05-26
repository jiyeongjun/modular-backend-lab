# Bootstrap Contract Index

## Macro Goal

Bootstrap `modular-backend-lab` into a production-grade TypeScript modular backend reference architecture based on `/Users/jiyeongjun/Desktop/bootstrap_prompt_modular_backend_lab_final.md`.

## Success Criteria

- Repository contains the required backend architecture structure or documented close equivalent.
- Node Active LTS policy is verified and recorded.
- TypeScript, pnpm, Biome, Vitest, dependency-cruiser, Docker Compose, and CI are configured.
- Hono remains an HTTP delivery adapter; Kysely remains a persistence adapter; worker/scheduler/queue adapters stay at the edge.
- Shared primitives, order module, explicit unit of work, Kysely repositories, outbox, job, queue adapter, docs, AI files, and convention scanner are implemented.
- Maintenance prompt governance, type-safety policy, AI playbooks, and convention scanner rules are reflected.
- Quality gates are run where possible: `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm arch:check`, `pnpm conventions:scan`, and `pnpm build`.
- Any unavailable verification, such as Docker-backed integration tests, is reported without claiming success.

## Scope

- Initialize the empty current folder as the backend reference repository.
- Create source, tests, documentation, AI maintenance files, local infrastructure config, and CI.
- Install exact stable dependency versions with pnpm.
- Prefer practical, runnable architecture over exhaustive production completeness.

## Non-Goals

- No production deployment.
- No real AWS SQS integration beyond documentation and adapter boundary guidance.
- No full ecommerce implementation beyond the reference order/payment workflow.
- No secrets or environment-specific credentials.

## Protected Surfaces

- Architecture boundaries between domain, application, ports, infra, http, jobs, and workers.
- Dependency/version policy and Node LTS selection.
- Database migration and repository concurrency behavior.
- Queue, observability, and scheduler adapter boundaries.
- AI convention harness intended to constrain future maintenance.

## Decisions

- The current folder is empty, so the user-specified bootstrap prompt file is used as the source document.
- Node 24 is selected because the local runtime is `v24.12.0` and official Node release metadata shows v24 as LTS while v26 is Current as of May 2026.
- Contract work is tracked in one bootstrap subcontract because the repository starts empty and the prompt already provides detailed success criteria.
- The follow-up "이것도" is interpreted as `/Users/jiyeongjun/Desktop/maintenance_prompt_modular_backend_lab_type_strict_final.md`, discovered as the new Desktop markdown file.

## Open Questions

- None. If Docker or registry access fails during verification, the limitation will be recorded in the final report.

## Subcontracts

- `contracts/contract-001.md` - Bootstrap the complete modular backend reference repository. Status: done. Next step: hand off final results. Verification: `pnpm quality` and `pnpm install --frozen-lockfile` passed.
- `contracts/contract-002.md` - Apply AI maintenance, governance, and type-safety prompt. Status: done. Next step: hand off final results. Verification: `pnpm quality` passed.
- `contracts/contract-003.md` - Add inventory module with reservations, concurrency, HTTP routes, and expiration job. Status: done. Next step: hand off final results. Verification: `pnpm quality` passed.
- `contracts/contract-004.md` - Add payment module with Toss Payments adapter. Status: done. Next step: hand off final results. Verification: `pnpm quality` passed.

## Current Status

- Active subcontract: none
- Status: done
- Last updated: 2026-05-26T04:20:00.000Z
