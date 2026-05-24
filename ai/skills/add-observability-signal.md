# Add Observability Signal

## Purpose

Add logs, metrics, or traces without leaking instrumentation into pure core logic.

## When To Use

Use when adding a new runtime signal around HTTP, jobs, workers, DB adapters, or queue adapters.

## Required Reading

- `docs/07-observability.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Decide whether the signal is log, metric, trace, or all three.
2. Add instrumentation in adapter/runtime code.
3. Include request ID, job name, or event ID where useful.
4. Avoid secrets and high-cardinality labels.
5. Update dashboards or docs when needed.
6. Keep metric labels and log fields typed and bounded where practical.

## Files Usually Touched

- `src/infra/telemetry/*`
- `src/http/middleware/*`
- `src/jobs/*`
- `observability/*`

## Tests/Checks To Run

- `pnpm typecheck`
- `pnpm test:unit`

## Forbidden Patterns

- Logging or telemetry imports in domain logic.
- Secret values in logs.
- High-cardinality metric labels.
- Telemetry SDK imports in domain/application.

## Definition Of Done

The signal is useful, low-cardinality, adapter-scoped, type-conscious, and documented if it changes
operations.
