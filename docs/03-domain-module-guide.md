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
