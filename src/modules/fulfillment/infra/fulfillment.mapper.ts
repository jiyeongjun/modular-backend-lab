import type {
  FulfillmentInsert,
  FulfillmentRow,
  FulfillmentUpdate,
} from "../../../infra/db/database.js";
import type {
  CancelledFulfillment,
  CarrierCode,
  CarrierShipmentStatus,
  DeliveredFulfillment,
  Fulfillment,
  FulfillmentStatus,
  LabelPurchasedFulfillment,
  PackedFulfillment,
  ReadyFulfillment,
  ShippedFulfillment,
  ShippingAddress,
} from "../domain/index.js";

function toFulfillmentStatus(value: string): FulfillmentStatus {
  if (
    value === "READY" ||
    value === "PACKED" ||
    value === "LABEL_PURCHASED" ||
    value === "SHIPPED" ||
    value === "DELIVERED" ||
    value === "CANCELLED"
  ) {
    return value;
  }
  throw new Error(`Unknown fulfillment status: ${value}`);
}

function toCarrierCode(value: string | null): CarrierCode {
  if (value === "LOCAL_TEST_CARRIER") {
    return value;
  }
  throw new Error(`Unknown shipping carrier: ${value ?? "null"}`);
}

function toCarrierShipmentStatus(value: string | null): CarrierShipmentStatus {
  if (value === "CREATED" || value === "IN_TRANSIT" || value === "DELIVERED") {
    return value;
  }
  throw new Error(`Unknown carrier shipment status: ${value ?? "null"}`);
}

function toCountry(value: string): ShippingAddress["country"] {
  if (value === "KR" || value === "US") {
    return value;
  }
  throw new Error(`Unknown fulfillment country: ${value}`);
}

function requireText(value: string | null, field: string, id: string): string {
  if (value === null || value.length === 0) {
    throw new Error(`Fulfillment ${id} must have ${field}`);
  }
  return value;
}

function requireDate(value: Date | null, field: string, id: string): Date {
  if (value === null) {
    throw new Error(`Fulfillment ${id} must have ${field}`);
  }
  return value;
}

function assertNoLabel(row: FulfillmentRow): void {
  if (
    row.label_idempotency_key !== null ||
    row.carrier !== null ||
    row.carrier_shipment_id !== null ||
    row.tracking_number !== null ||
    row.carrier_status !== null ||
    row.label_purchased_at !== null ||
    row.shipped_at !== null ||
    row.delivered_at !== null
  ) {
    throw new Error(`Fulfillment ${row.id} must not have shipping label fields`);
  }
}

function base(row: FulfillmentRow) {
  if (row.weight_grams <= 0) {
    throw new Error(`Fulfillment ${row.id} has invalid package weight`);
  }

  return {
    id: row.id,
    orderId: row.order_id,
    idempotencyKey: row.idempotency_key,
    recipient: {
      name: row.recipient_name,
      phone: row.recipient_phone,
      line1: row.address_line1,
      line2: row.address_line2,
      postalCode: row.postal_code,
      country: toCountry(row.country),
    },
    package: {
      weightGrams: row.weight_grams,
      description: row.package_description,
    },
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function labelFields(row: FulfillmentRow) {
  return {
    labelIdempotencyKey: requireText(row.label_idempotency_key, "label_idempotency_key", row.id),
    carrier: toCarrierCode(row.carrier),
    carrierShipmentId: requireText(row.carrier_shipment_id, "carrier_shipment_id", row.id),
    trackingNumber: requireText(row.tracking_number, "tracking_number", row.id),
    labelPurchasedAt: requireDate(row.label_purchased_at, "label_purchased_at", row.id),
  };
}

export function toFulfillment(row: FulfillmentRow): Fulfillment {
  switch (toFulfillmentStatus(row.status)) {
    case "READY": {
      assertNoLabel(row);
      if (row.packed_at !== null || row.cancelled_at !== null || row.cancel_reason !== null) {
        throw new Error(`Ready fulfillment ${row.id} has invalid timestamps`);
      }
      const fulfillment: ReadyFulfillment = {
        ...base(row),
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
      };
      return fulfillment;
    }

    case "PACKED": {
      assertNoLabel(row);
      if (row.packed_at === null || row.cancelled_at !== null || row.cancel_reason !== null) {
        throw new Error(`Packed fulfillment ${row.id} has invalid timestamps`);
      }
      const fulfillment: PackedFulfillment = {
        ...base(row),
        status: "PACKED",
        packedAt: row.packed_at,
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
      };
      return fulfillment;
    }

    case "LABEL_PURCHASED": {
      const carrierStatus = toCarrierShipmentStatus(row.carrier_status);
      if (
        row.packed_at === null ||
        carrierStatus !== "CREATED" ||
        row.shipped_at !== null ||
        row.delivered_at !== null ||
        row.cancelled_at !== null ||
        row.cancel_reason !== null
      ) {
        throw new Error(`Label purchased fulfillment ${row.id} has invalid state`);
      }
      const fulfillment: LabelPurchasedFulfillment = {
        ...base(row),
        ...labelFields(row),
        status: "LABEL_PURCHASED",
        packedAt: row.packed_at,
        carrierStatus,
        shippedAt: null,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
      };
      return fulfillment;
    }

    case "SHIPPED": {
      const carrierStatus = toCarrierShipmentStatus(row.carrier_status);
      if (
        row.packed_at === null ||
        carrierStatus !== "IN_TRANSIT" ||
        row.shipped_at === null ||
        row.delivered_at !== null ||
        row.cancelled_at !== null ||
        row.cancel_reason !== null
      ) {
        throw new Error(`Shipped fulfillment ${row.id} has invalid state`);
      }
      const fulfillment: ShippedFulfillment = {
        ...base(row),
        ...labelFields(row),
        status: "SHIPPED",
        packedAt: row.packed_at,
        carrierStatus,
        shippedAt: row.shipped_at,
        deliveredAt: null,
        cancelledAt: null,
        cancelReason: null,
      };
      return fulfillment;
    }

    case "DELIVERED": {
      const carrierStatus = toCarrierShipmentStatus(row.carrier_status);
      if (
        row.packed_at === null ||
        carrierStatus !== "DELIVERED" ||
        row.shipped_at === null ||
        row.delivered_at === null ||
        row.cancelled_at !== null ||
        row.cancel_reason !== null
      ) {
        throw new Error(`Delivered fulfillment ${row.id} has invalid state`);
      }
      const fulfillment: DeliveredFulfillment = {
        ...base(row),
        ...labelFields(row),
        status: "DELIVERED",
        packedAt: row.packed_at,
        carrierStatus,
        shippedAt: row.shipped_at,
        deliveredAt: row.delivered_at,
        cancelledAt: null,
        cancelReason: null,
      };
      return fulfillment;
    }

    case "CANCELLED": {
      assertNoLabel(row);
      if (row.cancelled_at === null || row.cancel_reason === null) {
        throw new Error(`Cancelled fulfillment ${row.id} must have cancellation details`);
      }
      const fulfillment: CancelledFulfillment = {
        ...base(row),
        status: "CANCELLED",
        packedAt: row.packed_at,
        labelIdempotencyKey: null,
        carrier: null,
        carrierShipmentId: null,
        trackingNumber: null,
        carrierStatus: null,
        labelPurchasedAt: null,
        shippedAt: null,
        deliveredAt: null,
        cancelledAt: row.cancelled_at,
        cancelReason: row.cancel_reason,
      };
      return fulfillment;
    }
  }
}

export function toFulfillmentInsert(fulfillment: ReadyFulfillment): FulfillmentInsert {
  return {
    id: fulfillment.id,
    order_id: fulfillment.orderId,
    idempotency_key: fulfillment.idempotencyKey,
    status: fulfillment.status,
    recipient_name: fulfillment.recipient.name,
    recipient_phone: fulfillment.recipient.phone,
    address_line1: fulfillment.recipient.line1,
    address_line2: fulfillment.recipient.line2,
    postal_code: fulfillment.recipient.postalCode,
    country: fulfillment.recipient.country,
    weight_grams: fulfillment.package.weightGrams,
    package_description: fulfillment.package.description,
    label_idempotency_key: fulfillment.labelIdempotencyKey,
    carrier: fulfillment.carrier,
    carrier_shipment_id: fulfillment.carrierShipmentId,
    tracking_number: fulfillment.trackingNumber,
    carrier_status: fulfillment.carrierStatus,
    packed_at: fulfillment.packedAt,
    label_purchased_at: fulfillment.labelPurchasedAt,
    shipped_at: fulfillment.shippedAt,
    delivered_at: fulfillment.deliveredAt,
    cancelled_at: fulfillment.cancelledAt,
    cancel_reason: fulfillment.cancelReason,
    version: fulfillment.version,
    created_at: fulfillment.createdAt,
    updated_at: fulfillment.updatedAt,
  };
}

export function toFulfillmentUpdate(fulfillment: Fulfillment): FulfillmentUpdate {
  return {
    status: fulfillment.status,
    recipient_name: fulfillment.recipient.name,
    recipient_phone: fulfillment.recipient.phone,
    address_line1: fulfillment.recipient.line1,
    address_line2: fulfillment.recipient.line2,
    postal_code: fulfillment.recipient.postalCode,
    country: fulfillment.recipient.country,
    weight_grams: fulfillment.package.weightGrams,
    package_description: fulfillment.package.description,
    label_idempotency_key: fulfillment.labelIdempotencyKey,
    carrier: fulfillment.carrier,
    carrier_shipment_id: fulfillment.carrierShipmentId,
    tracking_number: fulfillment.trackingNumber,
    carrier_status: fulfillment.carrierStatus,
    packed_at: fulfillment.packedAt,
    label_purchased_at: fulfillment.labelPurchasedAt,
    shipped_at: fulfillment.shippedAt,
    delivered_at: fulfillment.deliveredAt,
    cancelled_at: fulfillment.cancelledAt,
    cancel_reason: fulfillment.cancelReason,
    updated_at: fulfillment.updatedAt,
  };
}
