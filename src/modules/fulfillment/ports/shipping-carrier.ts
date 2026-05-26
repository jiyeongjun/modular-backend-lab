import type { Result } from "../../../shared/result/index.js";
import type {
  CarrierCode,
  CarrierShipmentStatus,
  ShipmentPackage,
  ShippingAddress,
} from "../domain/index.js";

export type PurchaseCarrierLabelCommand = Readonly<{
  fulfillmentId: string;
  orderId: string;
  idempotencyKey: string;
  recipient: ShippingAddress;
  package: ShipmentPackage;
}>;

export type CarrierLabel = Readonly<{
  carrier: CarrierCode;
  carrierShipmentId: string;
  trackingNumber: string;
  carrierStatus: CarrierShipmentStatus;
  purchasedAt: Date;
}>;

export type GetCarrierShipmentStatusCommand = Readonly<{
  carrier: CarrierCode;
  carrierShipmentId: string;
  trackingNumber: string;
}>;

export type CarrierShipmentStatusUpdate = Readonly<{
  carrierStatus: CarrierShipmentStatus;
  occurredAt: Date | null;
}>;

export type ShippingCarrierError = Readonly<{
  type: "ShippingCarrierRejected";
  carrier: CarrierCode;
  code: string;
  message: string;
  retryable: boolean;
}>;

export type ShippingCarrier = {
  purchaseLabel(
    command: PurchaseCarrierLabelCommand,
  ): Promise<Result<CarrierLabel, ShippingCarrierError>>;
  getShipmentStatus(
    command: GetCarrierShipmentStatusCommand,
  ): Promise<Result<CarrierShipmentStatusUpdate, ShippingCarrierError>>;
};
