# AI Coding Rules

Future AI agents must read `AGENTS.md` first and then the relevant `ai/skills/*.md` playbook.

## Workflow

1. Inspect existing module patterns.
2. Identify the target layer.
3. Preserve dependency direction.
4. Make the smallest coherent change.
5. Preserve strict TypeScript settings.
6. Prefer compile-time guarantees over runtime conventions when practical.
7. Prefer native TypeScript before new dependencies.
8. Add tests based on risk, not file count.
9. Avoid mock-heavy implementation-detail tests.
10. Update docs when conventions change.
11. Run typecheck, Biome check, tests, architecture check, convention scan, and build.
12. Report what changed and what could not be verified.

## Forbidden

Agents must not:

- rewrite unrelated architecture
- introduce new frameworks casually
- move files without reason
- hide DB queries or external calls inside domain logic
- use global mutable dependencies in core logic
- add a DI container
- add a functional framework
- use unbounded arrays for batch jobs
- add queue-specific code into application/domain
- add telemetry SDKs into domain/application
- add tests only to satisfy a coverage number
- weaken TypeScript compiler settings
- introduce `any`, `as any`, or broad type assertions to bypass the compiler
- replace discriminated unions with stringly typed error/status objects
- claim checks passed without running them
