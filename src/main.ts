import { serve } from "@hono/node-server";
import { createApp } from "./http/app.js";
import { loadConfig } from "./infra/config/env.js";
import { createDatabase } from "./infra/db/db.js";
import { checkDatabaseReadiness } from "./infra/db/readiness.js";
import { createLogger } from "./infra/logger/logger.js";
import { createMetricsRegistry } from "./infra/telemetry/metrics.js";
import { initializeTelemetry } from "./infra/telemetry/telemetry.js";
import {
  createAddAddressUseCase,
  createDisableAddressUseCase,
  createSetDefaultAddressUseCase,
  createUpdateAddressUseCase,
} from "./modules/address-book/application/index.js";
import { createKyselyAddressBookUnitOfWork } from "./modules/address-book/infra/index.js";
import { createAppendAuditRecordUseCase } from "./modules/audit-log/application/index.js";
import { createKyselyAuditLogUnitOfWork } from "./modules/audit-log/infra/index.js";
import {
  createDisableEmailCredentialUseCase,
  createLoginWithEmailUseCase,
  createRegisterEmailCredentialUseCase,
  createRevokeAuthSessionUseCase,
  createVerifyAuthSessionUseCase,
} from "./modules/auth/application/index.js";
import {
  createKyselyAuthUnitOfWork,
  createLocalAuthTokenService,
  createPbkdf2PasswordHasher,
} from "./modules/auth/infra/index.js";
import {
  createCheckAuthorizationUseCase,
  createGrantAuthorizationRoleUseCase,
  createRevokeAuthorizationRoleUseCase,
} from "./modules/authorization/application/index.js";
import { createKyselyAuthorizationUnitOfWork } from "./modules/authorization/infra/index.js";
import { createSubmitCheckoutUseCase } from "./modules/checkout/application/index.js";
import {
  createCheckoutInventoryAdapter,
  createCheckoutOrderAdapter,
  createCheckoutPaymentAdapter,
} from "./modules/checkout/infra/index.js";
import {
  createCloseCustomerUseCase,
  createReactivateCustomerUseCase,
  createRegisterCustomerUseCase,
  createSuspendCustomerUseCase,
} from "./modules/customer/application/index.js";
import { createKyselyCustomerUnitOfWork } from "./modules/customer/infra/index.js";
import {
  createCancelFulfillmentUseCase,
  createCreateFulfillmentUseCase,
  createGetFulfillmentForRefundUseCase,
  createMarkFulfillmentPackedUseCase,
  createPurchaseShippingLabelUseCase,
  createSyncFulfillmentCarrierStatusUseCase,
} from "./modules/fulfillment/application/index.js";
import {
  createKyselyFulfillmentUnitOfWork,
  createLocalShippingCarrier,
} from "./modules/fulfillment/infra/index.js";
import {
  createCommitReservationUseCase,
  createReleaseReservationUseCase,
  createReserveInventoryUseCase,
  createRestockInventoryUseCase,
} from "./modules/inventory/application/index.js";
import { createKyselyInventoryUnitOfWork } from "./modules/inventory/infra/index.js";
import {
  createCreateNotificationUseCase,
  createSendNotificationUseCase,
} from "./modules/notification/application/index.js";
import {
  createKyselyNotificationUnitOfWork,
  createLocalNotificationSender,
} from "./modules/notification/infra/index.js";
import {
  createPayOrderUseCase,
  createValidateOrderForCheckoutUseCase,
} from "./modules/order/application/index.js";
import { createKyselyOrderUnitOfWork } from "./modules/order/infra/index.js";
import {
  createCancelPaymentUseCase,
  createConfirmPaymentUseCase,
} from "./modules/payment/application/index.js";
import {
  createKyselyPaymentUnitOfWork,
  createTossPaymentsGateway,
  createUnavailablePaymentGateway,
} from "./modules/payment/infra/index.js";
import {
  createCommitCouponRedemptionUseCase,
  createCreateCouponUseCase,
  createQuoteCouponUseCase,
  createReleaseCouponRedemptionUseCase,
  createReserveCouponUseCase,
} from "./modules/promotion/application/index.js";
import { createKyselyPromotionUnitOfWork } from "./modules/promotion/infra/index.js";
import {
  createProcessRefundUseCase,
  createRejectRefundUseCase,
  createRequestRefundUseCase,
} from "./modules/refund/application/index.js";
import {
  createKyselyRefundUnitOfWork,
  createRefundFulfillmentAdapter,
  createRefundInventoryAdapter,
  createRefundPaymentAdapter,
} from "./modules/refund/infra/index.js";
import {
  createAuthorizeReturnUseCase,
  createCreateReturnRequestUseCase,
  createInspectReturnUseCase,
  createReceiveReturnUseCase,
} from "./modules/returns/application/index.js";
import { createKyselyReturnsUnitOfWork } from "./modules/returns/infra/index.js";
import {
  createGetSettlementUseCase,
  createSyncSettlementUseCase,
} from "./modules/settlement/application/index.js";
import {
  createKyselySettlementSourceReader,
  createKyselySettlementUnitOfWork,
} from "./modules/settlement/infra/index.js";
import {
  createAssignSupportTicketUseCase,
  createCloseSupportTicketUseCase,
  createCreateSupportTicketUseCase,
  createMarkSupportTicketWaitingUseCase,
  createResolveSupportTicketUseCase,
} from "./modules/support-ticket/application/index.js";
import { createKyselySupportTicketUnitOfWork } from "./modules/support-ticket/infra/index.js";
import { uuidGenerator } from "./shared/id/index.js";

const config = loadConfig();
const logger = createLogger(config);
const telemetry = initializeTelemetry(config, logger);
const db = createDatabase(config);
const addressBookUow = createKyselyAddressBookUnitOfWork(db);
const addAddressUseCase = createAddAddressUseCase({
  uow: addressBookUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const updateAddressUseCase = createUpdateAddressUseCase({
  uow: addressBookUow,
  now: () => new Date(),
});
const setDefaultAddressUseCase = createSetDefaultAddressUseCase({
  uow: addressBookUow,
  now: () => new Date(),
});
const disableAddressUseCase = createDisableAddressUseCase({
  uow: addressBookUow,
  now: () => new Date(),
});
const auditLogUow = createKyselyAuditLogUnitOfWork(db);
const appendAuditRecordUseCase = createAppendAuditRecordUseCase({
  uow: auditLogUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const authorizationUow = createKyselyAuthorizationUnitOfWork(db);
const grantAuthorizationRoleUseCase = createGrantAuthorizationRoleUseCase({
  uow: authorizationUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const revokeAuthorizationRoleUseCase = createRevokeAuthorizationRoleUseCase({
  uow: authorizationUow,
  now: () => new Date(),
});
const checkAuthorizationUseCase = createCheckAuthorizationUseCase({
  uow: authorizationUow,
});
const authUow = createKyselyAuthUnitOfWork(db);
const passwordHasher = createPbkdf2PasswordHasher();
const authTokenService = createLocalAuthTokenService();
const registerEmailCredentialUseCase = createRegisterEmailCredentialUseCase({
  uow: authUow,
  passwordHasher,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const loginWithEmailUseCase = createLoginWithEmailUseCase({
  uow: authUow,
  passwordHasher,
  tokenService: authTokenService,
  now: () => new Date(),
  generateSessionId: () => uuidGenerator.generate(),
  sessionTtlMs: 24 * 60 * 60 * 1000,
});
const verifyAuthSessionUseCase = createVerifyAuthSessionUseCase({
  uow: authUow,
  tokenService: authTokenService,
  now: () => new Date(),
});
const revokeAuthSessionUseCase = createRevokeAuthSessionUseCase({
  uow: authUow,
  tokenService: authTokenService,
  now: () => new Date(),
});
const disableEmailCredentialUseCase = createDisableEmailCredentialUseCase({
  uow: authUow,
  now: () => new Date(),
});
const customerUow = createKyselyCustomerUnitOfWork(db);
const registerCustomerUseCase = createRegisterCustomerUseCase({
  uow: customerUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const suspendCustomerUseCase = createSuspendCustomerUseCase({
  uow: customerUow,
  now: () => new Date(),
});
const reactivateCustomerUseCase = createReactivateCustomerUseCase({
  uow: customerUow,
  now: () => new Date(),
});
const closeCustomerUseCase = createCloseCustomerUseCase({
  uow: customerUow,
  now: () => new Date(),
});
const orderUow = createKyselyOrderUnitOfWork(db);
const payOrderUseCase = createPayOrderUseCase({
  uow: orderUow,
  now: () => new Date(),
});
const validateOrderForCheckoutUseCase = createValidateOrderForCheckoutUseCase({
  uow: orderUow,
});
const inventoryUow = createKyselyInventoryUnitOfWork(db);
const reserveInventoryUseCase = createReserveInventoryUseCase({
  uow: inventoryUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const releaseReservationUseCase = createReleaseReservationUseCase({
  uow: inventoryUow,
  now: () => new Date(),
});
const commitReservationUseCase = createCommitReservationUseCase({
  uow: inventoryUow,
  now: () => new Date(),
});
const notificationUow = createKyselyNotificationUnitOfWork(db);
const notificationSender = createLocalNotificationSender();
const createNotificationUseCase = createCreateNotificationUseCase({
  uow: notificationUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const sendNotificationUseCase = createSendNotificationUseCase({
  uow: notificationUow,
  sender: notificationSender,
  now: () => new Date(),
});
const restockInventoryUseCase = createRestockInventoryUseCase({
  uow: inventoryUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const paymentGateway =
  config.tossPayments.secretKey === null
    ? createUnavailablePaymentGateway("TOSS_PAYMENTS_SECRET_KEY is not configured")
    : createTossPaymentsGateway({
        secretKey: config.tossPayments.secretKey,
        baseUrl: config.tossPayments.baseUrl,
      });
const paymentUow = createKyselyPaymentUnitOfWork(db);
const confirmPaymentUseCase = createConfirmPaymentUseCase({
  uow: paymentUow,
  gateway: paymentGateway,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const cancelPaymentUseCase = createCancelPaymentUseCase({
  uow: paymentUow,
  gateway: paymentGateway,
  now: () => new Date(),
});
const submitCheckoutUseCase = createSubmitCheckoutUseCase({
  order: createCheckoutOrderAdapter({
    validateOrderForCheckoutUseCase,
    payOrderUseCase,
  }),
  inventory: createCheckoutInventoryAdapter({
    reserveInventoryUseCase,
    commitReservationUseCase,
    releaseReservationUseCase,
  }),
  payment: createCheckoutPaymentAdapter({
    confirmPaymentUseCase,
    cancelPaymentUseCase,
  }),
  now: () => new Date(),
  reservationTtlMs: 15 * 60 * 1000,
});
const fulfillmentUow = createKyselyFulfillmentUnitOfWork(db);
const shippingCarrier = createLocalShippingCarrier({ now: () => new Date() });
const createFulfillmentUseCase = createCreateFulfillmentUseCase({
  uow: fulfillmentUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const markFulfillmentPackedUseCase = createMarkFulfillmentPackedUseCase({
  uow: fulfillmentUow,
  now: () => new Date(),
});
const purchaseShippingLabelUseCase = createPurchaseShippingLabelUseCase({
  uow: fulfillmentUow,
  carrier: shippingCarrier,
  now: () => new Date(),
});
const cancelFulfillmentUseCase = createCancelFulfillmentUseCase({
  uow: fulfillmentUow,
  now: () => new Date(),
});
const syncFulfillmentCarrierStatusUseCase = createSyncFulfillmentCarrierStatusUseCase({
  uow: fulfillmentUow,
  carrier: shippingCarrier,
  now: () => new Date(),
});
const getFulfillmentForRefundUseCase = createGetFulfillmentForRefundUseCase({
  uow: fulfillmentUow,
});
const refundUow = createKyselyRefundUnitOfWork(db);
const requestRefundUseCase = createRequestRefundUseCase({
  uow: refundUow,
  fulfillment: createRefundFulfillmentAdapter({ getFulfillmentForRefundUseCase }),
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const processRefundUseCase = createProcessRefundUseCase({
  uow: refundUow,
  payment: createRefundPaymentAdapter({ cancelPaymentUseCase }),
  inventory: createRefundInventoryAdapter({ restockInventoryUseCase }),
  now: () => new Date(),
});
const rejectRefundUseCase = createRejectRefundUseCase({
  uow: refundUow,
  now: () => new Date(),
});
const returnsUow = createKyselyReturnsUnitOfWork(db);
const createReturnRequestUseCase = createCreateReturnRequestUseCase({
  uow: returnsUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const authorizeReturnUseCase = createAuthorizeReturnUseCase({
  uow: returnsUow,
  now: () => new Date(),
  generateRmaNumber: () => `RMA-${uuidGenerator.generate()}`,
});
const receiveReturnUseCase = createReceiveReturnUseCase({
  uow: returnsUow,
  now: () => new Date(),
});
const inspectReturnUseCase = createInspectReturnUseCase({
  uow: returnsUow,
  now: () => new Date(),
});
const promotionUow = createKyselyPromotionUnitOfWork(db);
const createCouponUseCase = createCreateCouponUseCase({
  uow: promotionUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const quoteCouponUseCase = createQuoteCouponUseCase({
  uow: promotionUow,
  now: () => new Date(),
});
const reserveCouponUseCase = createReserveCouponUseCase({
  uow: promotionUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const commitCouponRedemptionUseCase = createCommitCouponRedemptionUseCase({
  uow: promotionUow,
  now: () => new Date(),
});
const releaseCouponRedemptionUseCase = createReleaseCouponRedemptionUseCase({
  uow: promotionUow,
  now: () => new Date(),
});
const settlementUow = createKyselySettlementUnitOfWork(db);
const settlementSourceReader = createKyselySettlementSourceReader(db);
const syncSettlementUseCase = createSyncSettlementUseCase({
  sourceReader: settlementSourceReader,
  uow: settlementUow,
  now: () => new Date(),
});
const getSettlementUseCase = createGetSettlementUseCase({
  uow: settlementUow,
});
const supportTicketUow = createKyselySupportTicketUnitOfWork(db);
const createSupportTicketUseCase = createCreateSupportTicketUseCase({
  uow: supportTicketUow,
  now: () => new Date(),
  generateId: () => uuidGenerator.generate(),
});
const assignSupportTicketUseCase = createAssignSupportTicketUseCase({
  uow: supportTicketUow,
  now: () => new Date(),
});
const markSupportTicketWaitingUseCase = createMarkSupportTicketWaitingUseCase({
  uow: supportTicketUow,
  now: () => new Date(),
});
const resolveSupportTicketUseCase = createResolveSupportTicketUseCase({
  uow: supportTicketUow,
  now: () => new Date(),
});
const closeSupportTicketUseCase = createCloseSupportTicketUseCase({
  uow: supportTicketUow,
  now: () => new Date(),
});
const app = createApp({
  logger,
  metrics: createMetricsRegistry(),
  readinessCheck: () => checkDatabaseReadiness(db),
  addAddressUseCase,
  updateAddressUseCase,
  setDefaultAddressUseCase,
  disableAddressUseCase,
  appendAuditRecordUseCase,
  grantAuthorizationRoleUseCase,
  revokeAuthorizationRoleUseCase,
  checkAuthorizationUseCase,
  registerEmailCredentialUseCase,
  loginWithEmailUseCase,
  verifyAuthSessionUseCase,
  revokeAuthSessionUseCase,
  disableEmailCredentialUseCase,
  registerCustomerUseCase,
  suspendCustomerUseCase,
  reactivateCustomerUseCase,
  closeCustomerUseCase,
  payOrderUseCase,
  reserveInventoryUseCase,
  releaseReservationUseCase,
  commitReservationUseCase,
  createNotificationUseCase,
  sendNotificationUseCase,
  confirmPaymentUseCase,
  cancelPaymentUseCase,
  submitCheckoutUseCase,
  createFulfillmentUseCase,
  markFulfillmentPackedUseCase,
  purchaseShippingLabelUseCase,
  cancelFulfillmentUseCase,
  syncFulfillmentCarrierStatusUseCase,
  requestRefundUseCase,
  processRefundUseCase,
  rejectRefundUseCase,
  createReturnRequestUseCase,
  authorizeReturnUseCase,
  receiveReturnUseCase,
  inspectReturnUseCase,
  createCouponUseCase,
  quoteCouponUseCase,
  reserveCouponUseCase,
  commitCouponRedemptionUseCase,
  releaseCouponRedemptionUseCase,
  syncSettlementUseCase,
  getSettlementUseCase,
  createSupportTicketUseCase,
  assignSupportTicketUseCase,
  markSupportTicketWaitingUseCase,
  resolveSupportTicketUseCase,
  closeSupportTicketUseCase,
});

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    logger.info({ port: info.port }, "http server listening");
  },
);

let shutdownPromise: Promise<void> | null = null;

function closeServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function shutdown(signal: string): Promise<void> {
  if (shutdownPromise === null) {
    shutdownPromise = (async () => {
      logger.info({ signal }, "shutting down");
      await closeServer();
      await db.destroy();
      await telemetry.shutdown();
      logger.info({ signal }, "shutdown complete");
    })();
  }

  try {
    await shutdownPromise;
  } catch (error) {
    logger.error({ error, signal }, "shutdown failed");
    process.exitCode = 1;
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
