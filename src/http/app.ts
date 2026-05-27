import { Hono } from "hono";
import type { Logger } from "pino";
import type { HttpMetrics } from "../infra/telemetry/metrics.js";
import type {
  DisableEmailCredentialUseCase,
  LoginWithEmailUseCase,
  RegisterEmailCredentialUseCase,
  RevokeAuthSessionUseCase,
  VerifyAuthSessionUseCase,
} from "../modules/auth/application/index.js";
import { createAuthRoutes } from "../modules/auth/http/index.js";
import type { SubmitCheckoutUseCase } from "../modules/checkout/application/index.js";
import { createCheckoutRoutes } from "../modules/checkout/http/index.js";
import type {
  CloseCustomerUseCase,
  ReactivateCustomerUseCase,
  RegisterCustomerUseCase,
  SuspendCustomerUseCase,
} from "../modules/customer/application/index.js";
import { createCustomerRoutes } from "../modules/customer/http/index.js";
import type {
  CancelFulfillmentUseCase,
  CreateFulfillmentUseCase,
  MarkFulfillmentPackedUseCase,
  PurchaseShippingLabelUseCase,
  SyncFulfillmentCarrierStatusUseCase,
} from "../modules/fulfillment/application/index.js";
import { createFulfillmentRoutes } from "../modules/fulfillment/http/index.js";
import type {
  CommitReservationUseCase,
  ReleaseReservationUseCase,
  ReserveInventoryUseCase,
} from "../modules/inventory/application/index.js";
import { createInventoryRoutes } from "../modules/inventory/http/index.js";
import type {
  CreateNotificationUseCase,
  SendNotificationUseCase,
} from "../modules/notification/application/index.js";
import { createNotificationRoutes } from "../modules/notification/http/index.js";
import type { PayOrderUseCase } from "../modules/order/application/index.js";
import { createOrderRoutes } from "../modules/order/http/index.js";
import type {
  CancelPaymentUseCase,
  ConfirmPaymentUseCase,
} from "../modules/payment/application/index.js";
import { createPaymentRoutes } from "../modules/payment/http/index.js";
import type {
  CommitCouponRedemptionUseCase,
  CreateCouponUseCase,
  QuoteCouponUseCase,
  ReleaseCouponRedemptionUseCase,
  ReserveCouponUseCase,
} from "../modules/promotion/application/index.js";
import { createPromotionRoutes } from "../modules/promotion/http/index.js";
import type {
  ProcessRefundUseCase,
  RejectRefundUseCase,
  RequestRefundUseCase,
} from "../modules/refund/application/index.js";
import { createRefundRoutes } from "../modules/refund/http/index.js";
import type {
  AuthorizeReturnUseCase,
  CreateReturnRequestUseCase,
  InspectReturnUseCase,
  ReceiveReturnUseCase,
} from "../modules/returns/application/index.js";
import { createReturnsRoutes } from "../modules/returns/http/index.js";
import type {
  GetSettlementUseCase,
  SyncSettlementUseCase,
} from "../modules/settlement/application/index.js";
import { createSettlementRoutes } from "../modules/settlement/http/index.js";
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
  registerEmailCredentialUseCase: RegisterEmailCredentialUseCase;
  loginWithEmailUseCase: LoginWithEmailUseCase;
  verifyAuthSessionUseCase: VerifyAuthSessionUseCase;
  revokeAuthSessionUseCase: RevokeAuthSessionUseCase;
  disableEmailCredentialUseCase: DisableEmailCredentialUseCase;
  registerCustomerUseCase: RegisterCustomerUseCase;
  suspendCustomerUseCase: SuspendCustomerUseCase;
  reactivateCustomerUseCase: ReactivateCustomerUseCase;
  closeCustomerUseCase: CloseCustomerUseCase;
  payOrderUseCase: PayOrderUseCase;
  reserveInventoryUseCase: ReserveInventoryUseCase;
  releaseReservationUseCase: ReleaseReservationUseCase;
  commitReservationUseCase: CommitReservationUseCase;
  createNotificationUseCase: CreateNotificationUseCase;
  sendNotificationUseCase: SendNotificationUseCase;
  confirmPaymentUseCase: ConfirmPaymentUseCase;
  cancelPaymentUseCase: CancelPaymentUseCase;
  submitCheckoutUseCase: SubmitCheckoutUseCase;
  createFulfillmentUseCase: CreateFulfillmentUseCase;
  markFulfillmentPackedUseCase: MarkFulfillmentPackedUseCase;
  purchaseShippingLabelUseCase: PurchaseShippingLabelUseCase;
  cancelFulfillmentUseCase: CancelFulfillmentUseCase;
  syncFulfillmentCarrierStatusUseCase: SyncFulfillmentCarrierStatusUseCase;
  requestRefundUseCase: RequestRefundUseCase;
  processRefundUseCase: ProcessRefundUseCase;
  rejectRefundUseCase: RejectRefundUseCase;
  createReturnRequestUseCase: CreateReturnRequestUseCase;
  authorizeReturnUseCase: AuthorizeReturnUseCase;
  receiveReturnUseCase: ReceiveReturnUseCase;
  inspectReturnUseCase: InspectReturnUseCase;
  createCouponUseCase: CreateCouponUseCase;
  quoteCouponUseCase: QuoteCouponUseCase;
  reserveCouponUseCase: ReserveCouponUseCase;
  commitCouponRedemptionUseCase: CommitCouponRedemptionUseCase;
  releaseCouponRedemptionUseCase: ReleaseCouponRedemptionUseCase;
  syncSettlementUseCase: SyncSettlementUseCase;
  getSettlementUseCase: GetSettlementUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.onError(createErrorHandler(deps.logger));
  app.use("*", requestIdMiddleware());
  app.use("*", requestLoggerMiddleware(deps.logger));
  app.use("*", httpMetricsMiddleware(deps.metrics));

  app.route("/", createHealthRoutes());
  app.route("/", createMetricsRoutes(deps.metrics));
  app.route(
    "/",
    createAuthRoutes({
      registerEmailCredentialUseCase: deps.registerEmailCredentialUseCase,
      loginWithEmailUseCase: deps.loginWithEmailUseCase,
      verifyAuthSessionUseCase: deps.verifyAuthSessionUseCase,
      revokeAuthSessionUseCase: deps.revokeAuthSessionUseCase,
      disableEmailCredentialUseCase: deps.disableEmailCredentialUseCase,
    }),
  );
  app.route(
    "/",
    createCustomerRoutes({
      registerCustomerUseCase: deps.registerCustomerUseCase,
      suspendCustomerUseCase: deps.suspendCustomerUseCase,
      reactivateCustomerUseCase: deps.reactivateCustomerUseCase,
      closeCustomerUseCase: deps.closeCustomerUseCase,
    }),
  );
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
  app.route(
    "/",
    createNotificationRoutes({
      createNotificationUseCase: deps.createNotificationUseCase,
      sendNotificationUseCase: deps.sendNotificationUseCase,
    }),
  );
  app.route("/", createCheckoutRoutes({ submitCheckoutUseCase: deps.submitCheckoutUseCase }));
  app.route(
    "/",
    createFulfillmentRoutes({
      createFulfillmentUseCase: deps.createFulfillmentUseCase,
      markFulfillmentPackedUseCase: deps.markFulfillmentPackedUseCase,
      purchaseShippingLabelUseCase: deps.purchaseShippingLabelUseCase,
      cancelFulfillmentUseCase: deps.cancelFulfillmentUseCase,
      syncFulfillmentCarrierStatusUseCase: deps.syncFulfillmentCarrierStatusUseCase,
    }),
  );
  app.route(
    "/",
    createRefundRoutes({
      requestRefundUseCase: deps.requestRefundUseCase,
      processRefundUseCase: deps.processRefundUseCase,
      rejectRefundUseCase: deps.rejectRefundUseCase,
    }),
  );
  app.route(
    "/",
    createReturnsRoutes({
      createReturnRequestUseCase: deps.createReturnRequestUseCase,
      authorizeReturnUseCase: deps.authorizeReturnUseCase,
      receiveReturnUseCase: deps.receiveReturnUseCase,
      inspectReturnUseCase: deps.inspectReturnUseCase,
    }),
  );
  app.route(
    "/",
    createPromotionRoutes({
      createCouponUseCase: deps.createCouponUseCase,
      quoteCouponUseCase: deps.quoteCouponUseCase,
      reserveCouponUseCase: deps.reserveCouponUseCase,
      commitCouponRedemptionUseCase: deps.commitCouponRedemptionUseCase,
      releaseCouponRedemptionUseCase: deps.releaseCouponRedemptionUseCase,
    }),
  );
  app.route(
    "/",
    createSettlementRoutes({
      syncSettlementUseCase: deps.syncSettlementUseCase,
      getSettlementUseCase: deps.getSettlementUseCase,
    }),
  );

  return app;
}
