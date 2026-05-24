import { Hono } from "hono";
import type { HttpMetrics } from "../../infra/telemetry/metrics.js";
import type { AppBindings } from "../context.js";

export function createMetricsRoutes(metrics: HttpMetrics): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.get("/metrics", async (c) => {
    const body = await metrics.render();
    return c.body(body, 200, {
      "content-type": metrics.contentType,
    });
  });

  return app;
}
