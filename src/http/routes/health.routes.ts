import { Hono } from "hono";
import type { AppBindings } from "../context.js";

export type ReadinessCheck = () => Promise<boolean>;

export function createHealthRoutes(
  deps: { readinessCheck?: ReadinessCheck } = {},
): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.get("/healthz", (c) => c.json({ status: "ok" }));
  app.get("/readyz", async (c) => {
    const ready = deps.readinessCheck ? await deps.readinessCheck() : true;

    if (!ready) {
      return c.json({ status: "not_ready" }, 503);
    }

    return c.json({ status: "ready" });
  });

  return app;
}
