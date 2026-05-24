import { Counter, collectDefaultMetrics, Histogram, Registry } from "prom-client";

export type HttpMetrics = Readonly<{
  contentType: string;
  recordHttpRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }): void;
  render(): Promise<string>;
}>;

export function createMetricsRegistry(): HttpMetrics {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });

  const requestCounter = new Counter({
    name: "http_requests_total",
    help: "Total HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
  });

  const requestDuration = new Histogram({
    name: "http_request_duration_ms",
    help: "HTTP request duration in milliseconds",
    labelNames: ["method", "route", "status_code"],
    registers: [registry],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000],
  });

  return {
    contentType: registry.contentType,
    recordHttpRequest(input) {
      const labels = {
        method: input.method,
        route: input.route,
        status_code: String(input.statusCode),
      };
      requestCounter.inc(labels);
      requestDuration.observe(labels, input.durationMs);
    },
    render: () => registry.metrics(),
  };
}
