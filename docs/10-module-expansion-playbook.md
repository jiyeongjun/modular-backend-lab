# Module Expansion Playbook

Use this process when adding a new domain module.

## Steps

1. Define bounded context/module purpose.
2. Define domain model.
3. Define domain errors.
4. Define domain events if needed.
5. Implement pure domain logic.
6. Decide test scope based on risk.
7. Add domain behavior tests only for meaningful business behavior.
8. Define ports.
9. Implement application usecase.
10. Add application tests with fakes only where useful.
11. Add database migration if needed.
12. Implement Kysely repository and mappers.
13. Add infra integration tests for persistence changes.
14. Add Hono route and Zod schema.
15. Add HTTP route tests for contract behavior.
16. Add job/worker if needed.
17. Add queue adapter only if needed.
18. Add observability signal if useful.
19. Update README/docs.
20. Run quality gates.
21. Record an architecture decision if adding new patterns.

## Checklist

- Domain imports only shared code.
- Application imports only domain, ports, and shared code.
- Ports do not import infra or HTTP.
- DB rows are mapped explicitly.
- Zod schemas stay at boundaries.
- Expected failures return `Result`.
- Transactions are explicit.
- Large/unbounded work uses `AsyncIterable`.
- Concurrency is explicit and bounded.
- Tests are behavior-focused.
- TypeScript strictness is preserved.
- Docs are updated when policy or behavior changes.
