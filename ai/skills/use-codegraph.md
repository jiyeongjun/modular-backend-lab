# Use CodeGraph

## Purpose

Use the local CodeGraph index to understand code structure, call paths, and refactor impact before
falling back to broad grep/read exploration.

## When To Use

Use this playbook before:

- Explaining how a module, usecase, job, route, or adapter works.
- Tracing how one symbol reaches another symbol.
- Planning a refactor or checking what a symbol change can affect.
- Choosing focused tests for a source-file change.
- Reviewing architecture boundaries where callers/callees matter.

Skip it for single-file edits where the target file and behavior are already obvious.

## Local Setup

CodeGraph is a local developer/agent tool, not a project dependency.

```bash
codegraph status
```

If the repository is not initialized:

```bash
codegraph init -i
```

The generated `.codegraph/` directory is local index state and must not be committed.

## Command Map

```bash
codegraph status
```

Check whether the graph exists and is up to date.

```bash
codegraph query Order
```

Find symbols by name before reading files manually.

```bash
codegraph callers payOrder
codegraph callees payOrder
```

Inspect direct call relationships for a focused symbol.

```bash
codegraph impact payOrder
```

Estimate the blast radius before changing a symbol.

```bash
codegraph affected src/modules/order/domain/order.logic.ts
```

Ask which tests are likely affected by a changed source file.

## Workflow

1. Run `codegraph status`.
2. Use `codegraph query <name>` to find the target symbol when the location is unknown.
3. Use `codegraph callers`, `codegraph callees`, or `codegraph impact` for dependency questions.
4. Use `codegraph affected <file>` when selecting focused tests for changed files.
5. Read source files only after CodeGraph identifies the relevant files or symbols.
6. Run the normal repository checks. CodeGraph is an exploration aid, not a correctness gate.

## Rules

- Do not commit `.codegraph/`.
- Do not add CodeGraph as a package dependency.
- Do not replace `pnpm typecheck`, tests, dependency-cruiser, convention scan, or build with CodeGraph.
- If CodeGraph reports a stale or missing index, run `codegraph sync` or `codegraph init -i` before
  relying on query results.
