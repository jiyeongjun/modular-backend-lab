import { Hono } from "hono";
import type { Logger } from "pino";
import type { HttpMetrics } from "../infra/telemetry/metrics.js";
import type { SubmitCheckoutUseCase } from "../modules/checkout/application/index.js";
import { createCheckoutRoutes } from "../modules/checkout/http/index.js";
import type {
  CommitReservationUseCase,
  ReleaseReservationUseCase,
  ReserveInventoryUseCase,
} from "../modules/inventory/application/index.js";
import { createInventoryRoutes } from "../modules/inventory/http/index.js";
import type { PayOrderUseCase } from "../modules/order/application/index.js";
import { createOrderRoutes } from "../modules/order/http/index.js";
import type {
  CancelPaymentUseCase,
  ConfirmPaymentUseCase,
} from "../modules/payment/application/index.js";
import { createPaymentRoutes } from "../modules/payment/http/index.js";
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
  reserveInventoryUseCase: ReserveInventoryUseCase;
  releaseReservationUseCase: ReleaseReservationUseCase;
  commitReservationUseCase: CommitReservationUseCase;
  confirmPaymentUseCase: ConfirmPaymentUseCase;
  cancelPaymentUseCase: CancelPaymentUseCase;
  submitCheckoutUseCase: SubmitCheckoutUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.onError(createErrorHandler(deps.logger));
  app.use("*", requestIdMiddleware());
  app.use("*", requestLoggerMiddleware(deps.logger));
  app.use("*", httpMetricsMiddleware(deps.metrics));

  app.route("/", createHealthRoutes());
  app.route("/", createMetricsRoutes(deps.metrics));
  app.route("/", createOrderRoutes({ payOrderUseCase: deps.payOrderUseCase }));
  app.route(
    "/",
    createInventoryRoutes({
      reserveInventoryUseCase: deps.reserveInventoryUseCase,
      releaseReservationUseCase: deps.releaseReservationUseCase,
      commitReservationUseCase: deps.commitReservationUseCase,
    }),
  );
  app.route(
    "/",
    createPaymentRoutes({
      confirmPaymentUseCase: deps.confirmPaymentUseCase,
      cancelPaymentUseCase: deps.cancelPaymentUseCase,
    }),
  );
  app.route("/", createCheckoutRoutes({ submitCheckoutUseCase: deps.submitCheckoutUseCase }));

  return app;
}
