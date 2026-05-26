import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  ApplyCarrierStatusError,
  CancelFulfillmentError,
  CreateFulfillmentError,
  PackFulfillmentError,
  PurchaseShippingLabelError,
} from "./fulfillment.errors.js";
import type { FulfillmentEvent } from "./fulfillment.events.js";
import type {
  CarrierShipmentStatus,
  DeliveredFulfillment,
  Fulfillment,
  LabelPurchasedFulfillment,
  PackedFulfillment,
  PurchasedShippingLabel,
  ReadyFulfillment,
  ShipmentPackage,
  ShippedFulfillment,
  ShippingAddress,
  TrackableFulfillment,
} from "./fulfillment.js";

export type CreateFulfillmentInput = Readonly<{
  id: string;
  orderId: string;
  idempotencyKey: string;
  recipient: ShippingAddress;
  package: ShipmentPackage;
  now: Date;
}>;

export type FulfillmentTransition<T extends Fulfillment> = Readonly<{
  fulfillment: T;
  events: readonly FulfillmentEvent[];
}>;

export type CarrierStatusUpdate = Readonly<{
  carrierStatus: CarrierShipmentStatus;
  occurredAt: Date | null;
}>;

export function createFulfillment(
  input: CreateFulfillmentInput,
): Result<ReadyFulfillment, CreateFulfillmentError> {
  if (input.id.length === 0) {
    return err({
      type: "InvalidFulfillmentInput",
      field: "id",
      message: "Fulfillment id is required",
    });
  }

  if (input.orderId.length === 0) {
    return err({
      type: "InvalidFulfillmentInput",
      field: "orderId",
      message: "Order id is required",
    });
  }

  if (input.idempotencyKey.length === 0) {
    return err({
      type: "InvalidFulfillmentInput",
      field: "idempotencyKey",
      message: "Idempotency key is required",
    });
  }

  if (input.package.weightGrams <= 0) {
    return err({
      type: "InvalidFulfillmentPackage",
      message: "Package weight must be positive",
    });
  }

  const fulfillment: ReadyFulfillment = {
    id: input.id,
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
    recipient: input.recipient,
    package: input.package,
    status: "READY",
    packedAt: null,
    labelIdempotencyKey: null,
    carrier: null,
    carrierShipmentId: null,
    trackingNumber: null,
    carrierStatus: null,
    labelPurchasedAt: null,
    shippedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };

  return ok(fulfillment);
}

export function fulfillmentCreatedEvent(fulfillment: ReadyFulfillment): FulfillmentEvent {
  return {
    type: "FulfillmentCreated",
    aggregateType: "Fulfillment",
    aggregateId: fulfillment.id,
    occurredAt: fulfillment.createdAt,
    payload: {
      fulfillmentId: fulfillment.id,
      orderId: fulfillment.orderId,
      recipient: fulfillment.recipient,
    },
  };
}

export function markFulfillmentPacked(
  fulfillment: Fulfillment,
  now: Date,
): Result<FulfillmentTransition<PackedFulfillment>, PackFulfillmentError> {
  if (fulfillment.status !== "READY") {
    return err({
      type: "FulfillmentNotPackable",
      status: fulfillment.status,
      message: "Only ready fulfillments can be packed",
    });
  }

  const packed: PackedFulfillment = {
    ...fulfillment,
    status: "PACKED",
    packedAt: now,
    updatedAt: now,
  };

  return ok({
    fulfillment: packed,
    events: [
      {
        type: "FulfillmentPacked",
        aggregateType: "Fulfillment",
        aggregateId: packed.id,
        occurredAt: now,
        payload: {
          fulfillmentId: packed.id,
          orderId: packed.orderId,
        },
      },
    ],
  });
}

export function purchaseShippingLabel(
  fulfillment: Fulfillment,
  input: Readonly<{
    idempotencyKey: string;
    label: PurchasedShippingLabel;
    now: Date;
  }>,
): Result<FulfillmentTransition<LabelPurchasedFulfillment>, PurchaseShippingLabelError> {
  if (fulfillment.status !== "PACKED") {
    return err({
      type: "FulfillmentNotLabelable",
      status: fulfillment.status,
      message: "Only packed fulfillments can purchase shipping labels",
    });
  }

  if (
    input.idempotencyKey.length === 0 ||
    input.label.carrierShipmentId.length === 0 ||
    input.label.trackingNumber.length === 0 ||
    input.label.carrierStatus !== "CREATED"
  ) {
    return err({
      type: "InvalidShippingLabel",
      message: "Shipping label must include a created carrier shipment and tracking number",
    });
  }

  const labeled: LabelPurchasedFulfillment = {
    ...fulfillment,
    status: "LABEL_PURCHASED",
    labelIdempotencyKey: input.idempotencyKey,
    carrier: input.label.carrier,
    carrierShipmentId: input.label.carrierShipmentId,
    trackingNumber: input.label.trackingNumber,
    carrierStatus: input.label.carrierStatus,
    labelPurchasedAt: input.label.purchasedAt,
    shippedAt: null,
    deliveredAt: null,
    updatedAt: input.now,
  };

  return ok({
    fulfillment: labeled,
    events: [
      {
        type: "ShippingLabelPurchased",
        aggregateType: "Fulfillment",
        aggregateId: labeled.id,
        occurredAt: input.now,
        payload: {
          fulfillmentId: labeled.id,
          orderId: labeled.orderId,
          carrier: labeled.carrier,
          carrierShipmentId: labeled.carrierShipmentId,
          trackingNumber: labeled.trackingNumber,
        },
      },
    ],
  });
}

export function cancelFulfillment(
  fulfillment: Fulfillment,
  input: Readonly<{ reason: string; now: Date }>,
): Result<FulfillmentTransition<Fulfillment>, CancelFulfillmentError> {
  if (fulfillment.status !== "READY" && fulfillment.status !== "PACKED") {
    return err({
      type: "FulfillmentNotCancellable",
      status: fulfillment.status,
      message: "Only fulfillments without purchased labels can be cancelled",
    });
  }

  const cancelled = {
    ...fulfillment,
    status: "CANCELLED",
    cancelledAt: input.now,
    cancelReason: input.reason,
    updatedAt: input.now,
  } satisfies Fulfillment;

  return ok({
    fulfillment: cancelled,
    events: [
      {
        type: "FulfillmentCancelled",
        aggregateType: "Fulfillment",
        aggregateId: cancelled.id,
        occurredAt: input.now,
        payload: {
          fulfillmentId: cancelled.id,
          orderId: cancelled.orderId,
          reason: input.reason,
        },
      },
    ],
  });
}

export function applyCarrierShipmentStatus(
  fulfillment: Fulfillment,
  update: CarrierStatusUpdate,
  now: Date,
): Result<FulfillmentTransition<TrackableFulfillment>, ApplyCarrierStatusError> {
  switch (fulfillment.status) {
    case "LABEL_PURCHASED":
      return applyToLabelPurchased(fulfillment, update, now);

    case "SHIPPED":
      return applyToShipped(fulfillment, update, now);

    case "DELIVERED":
      return ok({ fulfillment, events: [] });

    case "READY":
    case "PACKED":
    case "CANCELLED":
      return err({
        type: "FulfillmentNotTrackable",
        status: fulfillment.status,
        message: "Fulfillment does not have a carrier shipment to track",
      });
  }
}

function applyToLabelPurchased(
  fulfillment: LabelPurchasedFulfillment,
  update: CarrierStatusUpdate,
  now: Date,
): Result<FulfillmentTransition<TrackableFulfillment>, ApplyCarrierStatusError> {
  switch (update.carrierStatus) {
    case "CREATED":
      return ok({ fulfillment, events: [] });

    case "IN_TRANSIT": {
      const shippedAt = update.occurredAt ?? now;
      const shipped: ShippedFulfillment = {
        ...fulfillment,
        status: "SHIPPED",
        carrierStatus: "IN_TRANSIT",
        shippedAt,
        updatedAt: now,
      };
      return ok({
        fulfillment: shipped,
        events: [fulfillmentShippedEvent(shipped, now)],
      });
    }

    case "DELIVERED": {
      const deliveredAt = update.occurredAt ?? now;
      const delivered: DeliveredFulfillment = {
        ...fulfillment,
        status: "DELIVERED",
        carrierStatus: "DELIVERED",
        shippedAt: deliveredAt,
        deliveredAt,
        updatedAt: now,
      };
      return ok({
        fulfillment: delivered,
        events: [fulfillmentDeliveredEvent(delivered, now)],
      });
    }
  }
}

function applyToShipped(
  fulfillment: ShippedFulfillment,
  update: CarrierStatusUpdate,
  now: Date,
): Result<FulfillmentTransition<TrackableFulfillment>, ApplyCarrierStatusError> {
  switch (update.carrierStatus) {
    case "CREATED":
      return err({
        type: "UnsupportedCarrierStatusTransition",
        currentStatus: fulfillment.status,
        carrierStatus: update.carrierStatus,
        message: "Carrier status cannot move a shipped fulfillment back to created",
      });

    case "IN_TRANSIT":
      return ok({ fulfillment, events: [] });

    case "DELIVERED": {
      const deliveredAt = update.occurredAt ?? now;
      const delivered: DeliveredFulfillment = {
        ...fulfillment,
        status: "DELIVERED",
        carrierStatus: "DELIVERED",
        deliveredAt,
        updatedAt: now,
      };
      return ok({
        fulfillment: delivered,
        events: [fulfillmentDeliveredEvent(delivered, now)],
      });
    }
  }
}

function fulfillmentShippedEvent(fulfillment: ShippedFulfillment, now: Date): FulfillmentEvent {
  return {
    type: "FulfillmentShipped",
    aggregateType: "Fulfillment",
    aggregateId: fulfillment.id,
    occurredAt: now,
    payload: {
      fulfillmentId: fulfillment.id,
      orderId: fulfillment.orderId,
      carrierStatus: fulfillment.carrierStatus,
      trackingNumber: fulfillment.trackingNumber,
    },
  };
}

function fulfillmentDeliveredEvent(fulfillment: DeliveredFulfillment, now: Date): FulfillmentEvent {
  return {
    type: "FulfillmentDelivered",
    aggregateType: "Fulfillment",
    aggregateId: fulfillment.id,
    occurredAt: now,
    payload: {
      fulfillmentId: fulfillment.id,
      orderId: fulfillment.orderId,
      carrierStatus: fulfillment.carrierStatus,
      trackingNumber: fulfillment.trackingNumber,
    },
  };
}
