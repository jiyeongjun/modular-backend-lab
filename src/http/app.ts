import { Hono } from "hono";
import type { Logger } from "pino";
import type { HttpMetrics } from "../infra/telemetry/metrics.js";
import type { PayOrderUseCase } from "../modules/order/application/index.js";
import { createOrderRoutes } from "../modules/order/http/index.js";
import type { AppBindings } from "./context.js";
import { createErrorHandler } from "./middleware/error-handler.js";
import { requestLoggerMiddleware } from "./middleware/logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { httpMetricsMiddleware } from "./middleware/telemetry.js";
import { createHealthRoutes } from "./routes/health.routes.js";
import { createMetricsRoutes } from "./routes/metrics.routes.js";

export function createApp(deps: {
  logger: Logger;
  metrics: HttpMetrics;
  payOrderUseCase: PayOrderUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.onError(createErrorHandler(deps.logger));
  app.use("*", requestIdMiddleware());
  app.use("*", requestLoggerMiddleware(deps.logger));
  app.use("*", httpMetricsMiddleware(deps.metrics));

  app.route("/", createHealthRoutes());
  app.route("/", createMetricsRoutes(deps.metrics));
  app.route("/", createOrderRoutes({ payOrderUseCase: deps.payOrderUseCase }));

  return app;
}
