# Architecture Overview

This repository keeps business code independent from delivery and infrastructure. Hono handles HTTP,
Kysely handles persistence, workers trigger jobs, queue libraries publish messages, and telemetry
observes the runtime. None of those concerns define domain behavior.

The preferred dependency flow is:

```txt
domain -> shared
application -> domain, ports, shared
infra -> ports, domain mappers, shared
http -> application usecases
jobs -> ports and processors
workers/main -> composition roots
```

Composition roots are allowed to know about multiple adapters because their job is wiring.
