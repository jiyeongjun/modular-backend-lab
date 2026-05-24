---
task: "Apply AI maintenance, governance, and type-safety prompt"
status: "done"
knowns:
  - "The repository has already been bootstrapped."
  - "The maintenance prompt is /Users/jiyeongjun/Desktop/maintenance_prompt_modular_backend_lab_type_strict_final.md."
  - "AGENTS.md, docs, ai skills, and convention-scan already exist and should be updated rather than blindly replaced."
unknowns:
  - "None."
next_step: "Hand off final results."
updated_at: "2026-05-24T07:44:30.000Z"
---

## Inputs

- `/Users/jiyeongjun/Desktop/maintenance_prompt_modular_backend_lab_type_strict_final.md`
- Existing bootstrapped repository files.

## Completion Criteria

- `AGENTS.md`, `CLAUDE.md`, Copilot instructions, and Cursor rules reflect the maintenance prompt.
- Docs `06` through `18` include testing, AI rules, module expansion, review, batch, queue, dependency, harness, skill catalog, definition of done, observability, and type-safety policy.
- `ai/skills/enforce-type-safety.md` exists and existing skill files reinforce strict type safety and compile-time feedback.
- `scripts/convention-scan.ts` catches practical architecture and type-safety drift from the prompt.
- Quality gates pass: `pnpm typecheck`, `pnpm check`, `pnpm test`, `pnpm arch:check`, `pnpm conventions:scan`, and `pnpm build`.

## Mutation Plan

- Extend contract index with this maintenance subcontract.
- Update AI-facing instruction files without duplicating all docs.
- Update governance docs, add type-safety policy, and refresh skill catalog.
- Strengthen convention scanner with simple maintainable checks for unsafe casts, `any`, non-null assertions, and tsconfig strictness.
- Run quality gates and repair issues.

## Verification

- `pnpm quality`
- Additional focused scanner/typecheck runs if needed.

## Work Log

- Maintenance prompt discovered from Desktop and selected as the likely referent for "이것도".
- Updated AI-facing instructions, policy docs, skill catalog, and convention scanner.
- Added `docs/18-type-safety-policy.md`.
- Added `ai/skills/enforce-type-safety.md`.
- Ran `pnpm quality` successfully.

## Result

- Done. Maintenance governance and type-safety prompt has been reflected.
