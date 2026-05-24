# Add Batch Job

## Purpose

Add a scheduled or long-running process without coupling it to a scheduler runtime.

## When To Use

Use for outbox publishing, imports, exports, replay, cleanup, settlement, or full-table scans.

## Required Reading

- `docs/12-batch-and-scheduler-policy.md`
- `docs/13-queue-backend-policy.md`
- `docs/18-type-safety-policy.md`

## Steps

1. Put processor logic under `src/jobs`.
2. Use `AsyncIterable` for large or unbounded input.
3. Inject ports and runtime concerns.
4. Keep scheduler logic under `src/workers`.
5. Test the processor without a real scheduler.
6. Type job commands, progress state, and retryable outcomes explicitly.

## Files Usually Touched

- `src/jobs/<job>/*`
- `src/workers/*`
- `src/modules/<module>/ports/*`

## Tests/Checks To Run

- `pnpm test:unit`
- `pnpm typecheck`
- `pnpm conventions:scan`

## Forbidden Patterns

- Loading unbounded work into arrays.
- Business logic inside scheduler adapters.
- Queue SDK imports in processors.
- Unbounded arrays or untyped payloads in processors.

## Definition Of Done

The job streams work, is scheduler-independent, has bounded concurrency where needed, and has tests
for success and failure handling.
