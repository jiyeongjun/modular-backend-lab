import type { CarrierCode, CarrierShipmentStatus, ShippingAddress } from "./fulfillment.js";

export type FulfillmentCreated = Readonly<{
  type: "FulfillmentCreated";
  aggregateType: "Fulfillment";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    fulfillmentId: string;
    orderId: string;
    recipient: ShippingAddress;
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
    carrier: CarrierCode;
    carrierShipmentId: string;
    trackingNumber: string;
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
  };
}>;

export type FulfillmentEvent =
  | FulfillmentCreated
  | FulfillmentPacked
  | ShippingLabelPurchased
  | FulfillmentShipped
  | FulfillmentDelivered
  | FulfillmentCancelled;
