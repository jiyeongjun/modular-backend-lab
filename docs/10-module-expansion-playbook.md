# Module Expansion Playbook

Use this process when adding a new domain module.

## Steps

1. Define bounded context/module purpose.
2. Optionally run `pnpm scaffold:module <name>` to create the standard folder shape.
3. Define domain model.
4. Define domain errors.
5. Define domain events if needed.
6. Implement pure domain logic.
7. Decide test scope based on risk.
8. Add domain behavior tests only for meaningful business behavior.
9. Define ports.
10. Implement application usecase.
11. Add application tests with fakes only where useful.
12. Add database migration if needed.
13. For stateful business aggregates, append domain events and update current projections in the
    repository transaction boundary.
14. Implement Kysely repository and mappers.
15. Use the shared outbox insert mapper for ordinary `outbox_events` row conversion when applicable.
16. Add infra integration tests for persistence changes.
17. Add Hono route and Zod schema.
18. Add HTTP route tests for contract behavior.
19. Use the route-test app factory so tests inject only the exercised usecases.
20. Add job/worker if needed.
21. Add queue adapter only if needed.
22. Add observability signal if useful.
23. Update README/docs.
24. Run quality gates.
25. Record an architecture decision if adding new patterns.

## Checklist

- Domain imports only shared code.
- Application imports only domain, ports, and shared code.
- Ports do not import infra or HTTP.
- DB rows are mapped explicitly.
- Domain event store and outbox are separate tables with separate purposes.
- Scaffolding and test factories do not become runtime architecture layers.
- Zod schemas stay at boundaries.
- Expected failures return `Result`.
- Transactions are explicit.
- Large/unbounded work uses `AsyncIterable`.
- Concurrency is explicit and bounded.
- Tests are behavior-focused.
- TypeScript strictness is preserved.
- Docs are updated when policy or behavior changes.
