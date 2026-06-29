# Convention Harness

The harness layers are:

```txt
1. AGENTS.md
   Intent and non-negotiable rules.

2. ai/skills/*.md
   Repeatable task playbooks for AI agents.

3. Biome
   Formatting/linting.

4. dependency-cruiser
   Import boundaries.

5. scripts/convention-scan.ts
   Repository-specific convention checks.

6. docs/17-definition-of-done.md
   Completion standard.

7. CI
   Enforces quality gates.
```

Biome catches style. dependency-cruiser catches import direction. `convention-scan` catches
repository-specific drift, including framework leakage, queue/event backend leakage outside
`src/infra/queue/**`, `src/infra/event-stream/**`, and `src/workers/**`, environment access outside
config, focused or skipped tests, unsafe type escape hatches, and weakened TypeScript strictness.

Keep the scanner simple and maintainable. Do not turn it into a compiler plugin.
