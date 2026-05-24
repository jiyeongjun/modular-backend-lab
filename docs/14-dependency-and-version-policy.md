# Dependency and Version Policy

## Rules

1. Use Node Active LTS.
2. Use stable dependency versions only.
3. Do not use alpha, beta, rc, next, or canary unless explicitly requested.
4. Use exact dependency versions.
5. Use pnpm lockfile.
6. Prefer official packages.
7. Prefer native TypeScript and Node APIs before adding dependencies.
8. Every new dependency requires a reason.
9. Do not add libraries for one-line utilities.
10. Do not add framework-level abstractions casually.
11. Run quality gates after dependency changes.
12. Document dependency changes in PR/commit summary.
13. Do not upgrade major versions casually.
14. For package upgrades, prefer small focused changes.

Examples:

```bash
pnpm add -E hono
pnpm add -D -E @biomejs/biome
```

## Tooling

Biome is the default formatter/linter. Use `pnpm check` for routine validation and
`pnpm check:write` to fix formatting/lint issues. Do not add Prettier. Do not add ESLint unless
documented. Architecture boundaries belong to dependency-cruiser. Repository-specific conventions
belong to `scripts/convention-scan.ts`.

Quality gates:

```bash
pnpm typecheck
pnpm check
pnpm test
pnpm arch:check
pnpm conventions:scan
pnpm build
```

Persistence changes:

```bash
pnpm test:integration
```
