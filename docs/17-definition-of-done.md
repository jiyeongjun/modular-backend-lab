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
12. `pnpm typecheck` passes.
13. `pnpm check` passes.
14. `pnpm test` passes.
15. `pnpm arch:check` passes.
16. `pnpm conventions:scan` passes.
17. `pnpm build` passes.
18. TypeScript strictness is preserved.
19. No unsafe casts or `any` are introduced without a documented reason.
20. Important domain states/errors/events are represented with precise types.
21. Exhaustive checks are updated when unions change.
22. Any checks that cannot run are explicitly reported.
