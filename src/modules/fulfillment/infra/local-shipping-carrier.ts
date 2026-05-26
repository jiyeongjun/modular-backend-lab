import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CarrierLabel,
  CarrierShipmentStatusUpdate,
  GetCarrierShipmentStatusCommand,
  PurchaseCarrierLabelCommand,
  ShippingCarrier,
  ShippingCarrierError,
} from "../ports/index.js";

export type LocalShippingCarrierConfig = Readonly<{
  now: () => Date;
}>;

export function createLocalShippingCarrier(config: LocalShippingCarrierConfig): ShippingCarrier {
  return {
    async purchaseLabel(command) {
      return ok(toCarrierLabel(command, config.now()));
    },

    async getShipmentStatus(command) {
      return toCarrierStatus(command, config.now());
    },
  };
}

export function createUnavailableShippingCarrier(message: string): ShippingCarrier {
  const unavailable: ShippingCarrierError = {
    type: "ShippingCarrierRejected",
    carrier: "LOCAL_TEST_CARRIER",
    code: "SHIPPING_CARRIER_NOT_CONFIGURED",
    message,
    retryable: true,
  };

  return {
    async purchaseLabel() {
      return err(unavailable);
    },

    async getShipmentStatus() {
      return err(unavailable);
    },
  };
}

function toCarrierLabel(command: PurchaseCarrierLabelCommand, now: Date): CarrierLabel {
  return {
    carrier: "LOCAL_TEST_CARRIER",
    carrierShipmentId: `local-shipment-${command.fulfillmentId}`,
    trackingNumber: `LOCAL-${command.fulfillmentId}`,
    carrierStatus: "CREATED",
    purchasedAt: now,
  };
}

function toCarrierStatus(
  command: GetCarrierShipmentStatusCommand,
  now: Date,
): Result<CarrierShipmentStatusUpdate, ShippingCarrierError> {
  if (command.carrier !== "LOCAL_TEST_CARRIER") {
    return err({
      type: "ShippingCarrierRejected",
      carrier: command.carrier,
      code: "UNSUPPORTED_CARRIER",
      message: "Local shipping carrier cannot track this carrier",
      retryable: false,
    });
  }

  return ok({
    carrierStatus: command.trackingNumber.endsWith("-DELIVERED") ? "DELIVERED" : "IN_TRANSIT",
    occurredAt: now,
  });
}
