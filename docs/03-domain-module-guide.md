# Domain Module Guide

A domain module owns its behavior, application usecases, ports, adapters, routes, and tests. Start
with pure domain types and functions. Add usecases only when orchestration, persistence, transactions,
or external side effects are needed.

Recommended shape:

```txt
modules/example/domain
modules/example/application
modules/example/ports
modules/example/infra
modules/example/http
modules/example/tests
```

Do not share another module's `infra` or `http` layer. Use application orchestration or domain events.

## Local Scaffold

Use the local scaffold only to create the standard folder shape:

```bash
pnpm scaffold:module example
```

The scaffold intentionally creates empty boundary indexes instead of generated business code. Domain
states, events, ports, persistence, routes, and tests should still be modeled from the requirement.

## Repetition Helpers

- Route tests can use `test/http/create-test-app.ts` so each route test provides only the usecase it
  exercises.
- Outbox repositories can use `src/infra/outbox/outbox-event.mapper.ts` for row insert conversion.
- These helpers are not a framework layer. They must not hide transaction boundaries, application
  dependencies, or domain decisions.
