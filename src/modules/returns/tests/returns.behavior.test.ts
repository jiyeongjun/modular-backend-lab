import { describe, expect, it } from "vitest";
import {
  authorizeReturn,
  createReturnRequest,
  inspectReturn,
  receiveReturn,
  returnRequestedEvent,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");
const receivedAt = new Date("2026-01-02T00:00:00.000Z");
const inspectedAt = new Date("2026-01-02T01:00:00.000Z");

function createRequestedReturn() {
  const result = createReturnRequest({
    id: "return-1",
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    idempotencyKey: "return-request-1",
    reason: "wrong size",
    items: [{ sku: "sku-1", quantity: 2 }],
    now,
  });
  if (!result.ok) {
    throw new Error("expected return request to be created");
  }
  return result.value;
}

describe("returns domain behavior", () => {
  it("walks through request, RMA authorization, receipt, and inspection approval", () => {
    const requested = createRequestedReturn();
    const authorized = authorizeReturn(requested, {
      rmaNumber: "RMA-1",
      now: later,
    });
    if (!authorized.ok) {
      throw new Error("expected return to be authorized");
    }
    const received = receiveReturn(authorized.value.returnRequest, receivedAt);
    if (!received.ok) {
      throw new Error("expected return to be received");
    }
    const inspected = inspectReturn(received.value.returnRequest, {
      accepted: true,
      restockableItems: [{ sku: "sku-1", quantity: 1 }],
      note: "one unit restockable",
      rejectionReason: null,
      now: inspectedAt,
    });

    expect(returnRequestedEvent(requested).type).toBe("ReturnRequested");
    expect(authorized.value.returnRequest.status).toBe("AUTHORIZED");
    expect(authorized.value.returnRequest.rmaNumber).toBe("RMA-1");
    expect(received.value.returnRequest.status).toBe("RECEIVED");
    expect(inspected.ok).toBe(true);
    if (!inspected.ok) {
      throw new Error("expected inspection to succeed");
    }
    expect(inspected.value.returnRequest.status).toBe("APPROVED");
    expect(inspected.value.returnRequest.restockableItems).toEqual([{ sku: "sku-1", quantity: 1 }]);
    expect(
      [...authorized.value.events, ...received.value.events, ...inspected.value.events].map(
        (event) => event.type,
      ),
    ).toEqual(["ReturnAuthorized", "ReturnReceived", "ReturnInspectionApproved"]);
  });

  it("does not receive a return before RMA authorization", () => {
    const result = receiveReturn(createRequestedReturn(), receivedAt);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected receive to fail");
    }
    expect(result.error.type).toBe("ReturnNotReceivable");
  });

  it("rejects restockable quantities above the requested return quantity", () => {
    const authorized = authorizeReturn(createRequestedReturn(), {
      rmaNumber: "RMA-1",
      now: later,
    });
    if (!authorized.ok) {
      throw new Error("expected return to be authorized");
    }
    const received = receiveReturn(authorized.value.returnRequest, receivedAt);
    if (!received.ok) {
      throw new Error("expected return to be received");
    }

    const result = inspectReturn(received.value.returnRequest, {
      accepted: true,
      restockableItems: [{ sku: "sku-1", quantity: 3 }],
      note: null,
      rejectionReason: null,
      now: inspectedAt,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected inspection to fail");
    }
    expect(result.error.type).toBe("ReturnInspectionRestockQuantityExceeded");
  });
});
