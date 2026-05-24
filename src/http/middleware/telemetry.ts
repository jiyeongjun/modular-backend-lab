import { performance } from "node:perf_hooks";
import type { MiddlewareHandler } from "hono";
import type { HttpMetrics } from "../../infra/telemetry/metrics.js";
import type { AppBindings } from "../context.js";

export function httpMetricsMiddleware(metrics: HttpMetrics): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const startedAt = performance.now();
    await next();

    metrics.recordHttpRequest({
      method: c.req.method,
      route: c.req.routePath || c.req.path,
      statusCode: c.res.status,
      durationMs: performance.now() - startedAt,
    });
  };
}
