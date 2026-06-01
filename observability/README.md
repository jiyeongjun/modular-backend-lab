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

## Local Kubernetes

The kind baseline in `deploy/k8s/local/` runs Grafana, Prometheus, Tempo, Loki, Alloy, and
kube-state-metrics in the `modular-backend-lab` namespace.

```bash
scripts/k8s-local-up.sh
scripts/k8s-local-port-forward.sh
```

Local Kubernetes endpoints after port-forwarding:

- Grafana: http://localhost:3001 (`admin` / `admin`)
- Prometheus: http://localhost:9090
- API health: http://localhost:3000/healthz

Prometheus scrapes `api:3000/metrics` and kube-state-metrics. Grafana dashboards can show HTTP
metrics plus API/worker/scheduler pod and deployment state. Loki is provisioned as a datasource, but
this baseline does not add application log shipping; logs remain JSON-shaped at stdout/stderr for a
future collector.
