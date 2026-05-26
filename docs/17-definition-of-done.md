# Definition of Done

A meaningful change is done when:

1. Code follows layer boundaries.
2. Domain/application remain portable.
3. Expected failures use `Result`.
4. Transactions are explicit where needed.
5. Persistence maps rows explicitly.
6. Batch jobs use `AsyncIterable` for large/unbounded work.
7. Queue adapters do not leak into core.
8. Observability does not pollute domain/application.
9. Tests are added based on risk.
10. Trivial tests are avoided.
11. Docs are updated when conventions or behavior change.
12. Scaffolding, test factories, and shared mappers do not hide architectural boundaries.
13. `pnpm typecheck` passes.
14. `pnpm check` passes.
15. `pnpm test` passes.
16. `pnpm arch:check` passes.
17. `pnpm conventions:scan` passes.
18. `pnpm build` passes.
19. TypeScript strictness is preserved.
20. No unsafe casts or `any` are introduced without a documented reason.
21. Important domain states/errors/events are represented with precise types.
22. Exhaustive checks are updated when unions change.
23. Any checks that cannot run are explicitly reported.
