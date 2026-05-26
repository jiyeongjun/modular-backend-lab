import { describe, expect, it } from "vitest";
import {
  applyCarrierShipmentStatus,
  createFulfillment,
  markFulfillmentPacked,
  purchaseShippingLabel,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const recipient = {
  name: "Kim",
  phone: "010-0000-0000",
  line1: "Seoul",
  line2: null,
  postalCode: "12345",
  country: "KR",
} as const;
const shipmentPackage = {
  weightGrams: 500,
  description: "T-shirt",
} as const;

describe("fulfillment domain behavior", () => {
  it("creates, packs, purchases a label, and advances carrier status", () => {
    const created = createFulfillment({
      id: "fulfillment-1",
      orderId: "order-1",
      idempotencyKey: "create-1",
      recipient,
      package: shipmentPackage,
      now,
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error("expected fulfillment to be created");
    }

    const packed = markFulfillmentPacked(created.value, later);
    expect(packed.ok).toBe(true);
    if (!packed.ok) {
      throw new Error("expected fulfillment to be packed");
    }

    const labeled = purchaseShippingLabel(packed.value.fulfillment, {
      idempotencyKey: "label-1",
      label: {
        carrier: "LOCAL_TEST_CARRIER",
        carrierShipmentId: "carrier-shipment-1",
        trackingNumber: "tracking-1",
        carrierStatus: "CREATED",
        purchasedAt: later,
      },
      now: later,
    });
    expect(labeled.ok).toBe(true);
    if (!labeled.ok) {
      throw new Error("expected label to be purchased");
    }

    const shipped = applyCarrierShipmentStatus(
      labeled.value.fulfillment,
      { carrierStatus: "IN_TRANSIT", occurredAt: later },
      later,
    );

    expect(shipped.ok).toBe(true);
    if (!shipped.ok) {
      throw new Error("expected fulfillment to ship");
    }
    expect(shipped.value.fulfillment.status).toBe("SHIPPED");
    expect(shipped.value.events[0]?.type).toBe("FulfillmentShipped");
  });

  it("rejects non-positive package weight", () => {
    const created = createFulfillment({
      id: "fulfillment-1",
      orderId: "order-1",
      idempotencyKey: "create-1",
      recipient,
      package: { ...shipmentPackage, weightGrams: 0 },
      now,
    });

    expect(created).toEqual({
      ok: false,
      error: {
        type: "InvalidFulfillmentPackage",
        message: "Package weight must be positive",
      },
    });
  });
});
