import pino from "pino";
import { createApp } from "../../src/http/app.js";
import { createMetricsRegistry } from "../../src/infra/telemetry/metrics.js";

type AppDeps = Parameters<typeof createApp>[0];

export type RouteTestAppOverrides = Partial<AppDeps>;

function unexpectedUseCase(routeName: string): () => Promise<never> {
  return async () => {
    throw new Error(`unexpected ${routeName} route call`);
  };
}

export function createRouteTestApp(overrides: RouteTestAppOverrides = {}) {
  return createApp({
    logger: overrides.logger ?? pino({ enabled: false }),
    metrics: overrides.metrics ?? createMetricsRegistry(),
    addAddressUseCase: overrides.addAddressUseCase ?? unexpectedUseCase("address-book"),
    updateAddressUseCase: overrides.updateAddressUseCase ?? unexpectedUseCase("address-book"),
    setDefaultAddressUseCase:
      overrides.setDefaultAddressUseCase ?? unexpectedUseCase("address-book"),
    disableAddressUseCase: overrides.disableAddressUseCase ?? unexpectedUseCase("address-book"),
    registerEmailCredentialUseCase:
      overrides.registerEmailCredentialUseCase ?? unexpectedUseCase("auth"),
    loginWithEmailUseCase: overrides.loginWithEmailUseCase ?? unexpectedUseCase("auth"),
    verifyAuthSessionUseCase: overrides.verifyAuthSessionUseCase ?? unexpectedUseCase("auth"),
    revokeAuthSessionUseCase: overrides.revokeAuthSessionUseCase ?? unexpectedUseCase("auth"),
    disableEmailCredentialUseCase:
      overrides.disableEmailCredentialUseCase ?? unexpectedUseCase("auth"),
    registerCustomerUseCase: overrides.registerCustomerUseCase ?? unexpectedUseCase("customer"),
    suspendCustomerUseCase: overrides.suspendCustomerUseCase ?? unexpectedUseCase("customer"),
    reactivateCustomerUseCase: overrides.reactivateCustomerUseCase ?? unexpectedUseCase("customer"),
    closeCustomerUseCase: overrides.closeCustomerUseCase ?? unexpectedUseCase("customer"),
    payOrderUseCase: overrides.payOrderUseCase ?? unexpectedUseCase("order"),
    reserveInventoryUseCase: overrides.reserveInventoryUseCase ?? unexpectedUseCase("inventory"),
    releaseReservationUseCase:
      overrides.releaseReservationUseCase ?? unexpectedUseCase("inventory"),
    commitReservationUseCase: overrides.commitReservationUseCase ?? unexpectedUseCase("inventory"),
    createNotificationUseCase:
      overrides.createNotificationUseCase ?? unexpectedUseCase("notification"),
    sendNotificationUseCase: overrides.sendNotificationUseCase ?? unexpectedUseCase("notification"),
    confirmPaymentUseCase: overrides.confirmPaymentUseCase ?? unexpectedUseCase("payment"),
    cancelPaymentUseCase: overrides.cancelPaymentUseCase ?? unexpectedUseCase("payment"),
    submitCheckoutUseCase: overrides.submitCheckoutUseCase ?? unexpectedUseCase("checkout"),
    createFulfillmentUseCase:
      overrides.createFulfillmentUseCase ?? unexpectedUseCase("fulfillment"),
    markFulfillmentPackedUseCase:
      overrides.markFulfillmentPackedUseCase ?? unexpectedUseCase("fulfillment"),
    purchaseShippingLabelUseCase:
      overrides.purchaseShippingLabelUseCase ?? unexpectedUseCase("fulfillment"),
    cancelFulfillmentUseCase:
      overrides.cancelFulfillmentUseCase ?? unexpectedUseCase("fulfillment"),
    syncFulfillmentCarrierStatusUseCase:
      overrides.syncFulfillmentCarrierStatusUseCase ?? unexpectedUseCase("fulfillment"),
    requestRefundUseCase: overrides.requestRefundUseCase ?? unexpectedUseCase("refund"),
    processRefundUseCase: overrides.processRefundUseCase ?? unexpectedUseCase("refund"),
    rejectRefundUseCase: overrides.rejectRefundUseCase ?? unexpectedUseCase("refund"),
    createReturnRequestUseCase:
      overrides.createReturnRequestUseCase ?? unexpectedUseCase("returns"),
    authorizeReturnUseCase: overrides.authorizeReturnUseCase ?? unexpectedUseCase("returns"),
    receiveReturnUseCase: overrides.receiveReturnUseCase ?? unexpectedUseCase("returns"),
    inspectReturnUseCase: overrides.inspectReturnUseCase ?? unexpectedUseCase("returns"),
    createCouponUseCase: overrides.createCouponUseCase ?? unexpectedUseCase("promotion"),
    quoteCouponUseCase: overrides.quoteCouponUseCase ?? unexpectedUseCase("promotion"),
    reserveCouponUseCase: overrides.reserveCouponUseCase ?? unexpectedUseCase("promotion"),
    commitCouponRedemptionUseCase:
      overrides.commitCouponRedemptionUseCase ?? unexpectedUseCase("promotion"),
    releaseCouponRedemptionUseCase:
      overrides.releaseCouponRedemptionUseCase ?? unexpectedUseCase("promotion"),
    syncSettlementUseCase: overrides.syncSettlementUseCase ?? unexpectedUseCase("settlement"),
    getSettlementUseCase: overrides.getSettlementUseCase ?? unexpectedUseCase("settlement"),
  });
}
