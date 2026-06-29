# Review Checklist

## CodeGraph-Assisted Review

Use CodeGraph as a review aid before broad manual exploration when a change touches shared symbols,
cross-layer flow, routes, usecases, jobs, or module boundaries.

- Run `codegraph status` first. If the index is missing or stale, run `codegraph init -i` or
  `codegraph sync`.
- For domain/application symbol changes, run `codegraph impact <symbol>` to inspect caller and route
  blast radius before deciding the review scope.
- For usecase, route, job, or adapter changes, run `codegraph callers <symbol>` and
  `codegraph callees <symbol>` where the call path is not obvious.
- For changed source files, run `codegraph affected <file>` to help choose focused tests.
- Treat CodeGraph output as review context only. Final verification still comes from tests,
  typecheck, dependency-cruiser, convention scan, build, and any relevant smoke checks.

## Questions

- Did domain import any framework or infra dependency?
- Did application import Hono or Kysely?
- Did application import BullMQ, SQS, Kafka/MSK, Valkey, or Redis clients?
- Did domain/application import telemetry SDKs?
- Are business errors modeled as `Result`?
- Are unexpected errors allowed to throw?
- Are transactions explicit?
- Are DB rows mapped explicitly?
- Are Zod schemas only used at boundaries?
- Are HTTP routes thin?
- Do full-app route tests use the route-test app factory instead of duplicating unrelated stubs?
- Are batch jobs using `AsyncIterable` for large or unbounded work?
- Is concurrency explicit and bounded?
- Are queue consumers idempotent where needed?
- Are long-running DB transactions avoided?
- Are observability signals added in edge/infra layers?
- Are tests risk-based rather than file-based?
- Are tests focused on observable behavior?
- Are mock-heavy tests avoided?
- Are docs updated?
- Is the design simpler than the problem requires?
- Is there any premature abstraction?
- Did scaffolding or helper reuse avoid becoming a hidden framework layer?
- Is cross-module coupling controlled?
- Did dependency changes use stable exact versions?
- Did Biome pass?
- Did architecture check pass?
- Did typecheck pass without weakening compiler settings?
- Did the change avoid `any`, `as any`, broad casts, and unjustified non-null assertions?
- Are domain states, errors, and events represented with discriminated unions where appropriate?
- Are new union variants handled exhaustively?
- Are invalid states made difficult or impossible to represent?
- Did convention scan pass?
