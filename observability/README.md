# Observability

Local observability is intentionally separate from application startup.

Start it with:

```bash
pnpm observability:up
```

Local endpoints:

- Grafana: http://localhost:3001 (`admin` / `admin`)
- Prometheus: http://localhost:9090
- Tempo: http://localhost:3200
- Loki: http://localhost:3100
- OTLP HTTP: http://localhost:4318

The application emits Prometheus metrics at `/metrics` and can export OpenTelemetry traces and
metrics to the OTLP endpoint. Pino logs stay JSON-shaped so they can be collected by a log agent in
production.
