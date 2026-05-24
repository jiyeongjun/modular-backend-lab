import { Hono } from "hono";
import type { AppBindings } from "../context.js";

export function createHealthRoutes(): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.get("/healthz", (c) => c.json({ status: "ok" }));
  app.get("/readyz", (c) => c.json({ status: "ready" }));

  return app;
}
