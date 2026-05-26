import type {
  CarrierCode,
  CarrierShipmentStatus,
  ShipmentPackage,
  ShippingAddress,
} from "./fulfillment.js";

export type FulfillmentCreated = Readonly<{
  type: "FulfillmentCreated";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    idempotencyKey: string;
    recipient: ShippingAddress;
    package: ShipmentPackage;
  };
}>;

export type FulfillmentPacked = Readonly<{
  type: "FulfillmentPacked";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    packedAt: Date;
  };
}>;

export type ShippingLabelPurchased = Readonly<{
  type: "ShippingLabelPurchased";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    labelIdempotencyKey: string;
    carrier: CarrierCode;
    carrierShipmentId: string;
    trackingNumber: string;
    carrierStatus: CarrierShipmentStatus;
    labelPurchasedAt: Date;
  };
}>;

export type FulfillmentShipped = Readonly<{
  type: "FulfillmentShipped";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    carrierStatus: CarrierShipmentStatus;
    trackingNumber: string;
    shippedAt: Date;
  };
}>;

export type FulfillmentDelivered = Readonly<{
  type: "FulfillmentDelivered";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    carrierStatus: CarrierShipmentStatus;
    trackingNumber: string;
    shippedAt: Date;
    deliveredAt: Date;
  };
}>;

export type FulfillmentCancelled = Readonly<{
  type: "FulfillmentCancelled";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    reason: string;
    cancelledAt: Date;
  };
}>;

export type FulfillmentEvent =
  | FulfillmentCreated
  | FulfillmentPacked
  | ShippingLabelPurchased
  | FulfillmentShipped
  | FulfillmentDelivered
  | FulfillmentCancelled;
