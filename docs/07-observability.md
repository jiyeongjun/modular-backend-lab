# Observability

Observability is an adapter boundary, not business logic.

## Runtime Model

- Pino emits structured JSON logs.
- OpenTelemetry handles traces and metrics.
- Grafana is the local visualization runtime.
- Prometheus scrapes metrics where applicable.
- Tempo stores traces.
- Loki stores logs.
- Grafana Alloy or OpenTelemetry Collector handles collection/export.

## Rules

- Domain logic must not import telemetry.
- Application logic should not directly depend on telemetry SDKs.
- Instrumentation belongs in HTTP, infra, jobs, workers, and composition roots.
- Logs should include request ID.
- Logs should include trace ID where practical.
- Worker/job logs should include job name and run ID.
- Do not log secrets.
- Avoid high-cardinality labels in metrics.
- Prefer simple working telemetry over complex broken telemetry.

## Local Stack

Start local observability with:

```bash
docker compose -f docker-compose.observability.yml up -d
```

or:

```bash
pnpm observability:up
```

Local URLs:

- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100
- OTLP HTTP endpoint: http://localhost:4318

Inspect request rates and latency in Grafana, raw metrics in Prometheus, traces in Tempo, and logs in
Loki when log collection is configured.

Use `ai/skills/add-observability-signal.md` before adding a metric, span, or log.
