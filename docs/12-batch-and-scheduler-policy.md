# Batch and Scheduler Policy

Default rule:

```txt
Bounded request/response API data -> Promise<T> or Promise<T[]>
Large/unbounded data processing -> AsyncIterable<T>
```

Use `AsyncIterable` for scheduled jobs, full table scans, large exports/imports, outbox publishing,
event replay, settlement, large notification sending, cleanup jobs, external paginated API ingestion,
and search index rebuilds.

Do not use `AsyncIterable` everywhere. It is not the default for normal HTTP APIs.

## Job Structure

```txt
src/jobs/{job-name}/
  {job-name}.job.ts
  {job-name}.processor.ts
  {job-name}.test.ts
```

Scheduling/runtime adapters live under:

```txt
src/workers/
```

## Rules

1. Batch processors must not load unbounded datasets into arrays.
2. Repositories that support large scans should expose methods like `iterateSomething(...)`.
3. `iterateSomething(...)` should return `AsyncIterable<T>`.
4. Cursor-based pagination is preferred over offset pagination for large scans.
5. Batch processing should avoid long-running DB transactions.
6. External calls must not be performed inside long DB transactions unless explicitly justified.
7. Concurrency must be explicit and bounded.
8. Idempotency must be considered for every scheduled job.
9. Jobs should be restartable where practical.
10. Job progress, cursor, or processed state should be persisted when needed.
11. Outbox publishing must be idempotent or safely retryable.
12. Use native async generators and small shared iterable utilities.
13. Do not introduce IxJS, FxTS, RxJS, Effect, or fp-ts unless there is a documented reason.

## Patterns

```ts
for await (const item of repository.iterateItems(command)) {
  await processor.process(item);
}
```

```ts
for await (const chunk of chunkAsync(repository.iterateItems(command), 500)) {
  await processor.processChunk(chunk);
}
```

```ts
for await (const result of parallelMapAsync(items, processItem, {
  concurrency: 5,
})) {
  // handle result
}
```

Batch logic should be tested without requiring a real scheduler. The scheduler is only a
delivery/runtime adapter, similar to Hono as HTTP delivery adapter.

Production scheduling options include cron, Kubernetes CronJob, Cloud Scheduler, EventBridge
Scheduler, Temporal, BullMQ repeatable jobs, and queue-triggered workers. The production scheduler
choice belongs to deployment architecture.
