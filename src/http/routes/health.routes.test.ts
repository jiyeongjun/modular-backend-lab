import { describe, expect, it } from "vitest";
import { createHealthRoutes } from "./health.routes.js";

describe("health routes", () => {
  it("reports ready when readiness check passes", async () => {
    const app = createHealthRoutes({ readinessCheck: async () => true });

    const response = await app.request("/readyz");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ready" });
  });

  it("reports not ready when readiness check fails", async () => {
    const app = createHealthRoutes({ readinessCheck: async () => false });

    const response = await app.request("/readyz");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });
});
