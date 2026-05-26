import { describe, expect, it } from "vitest";
import {
  createAuthorizeReturnUseCase,
  createCreateReturnRequestUseCase,
  createReceiveReturnUseCase,
} from "../application/index.js";
import type { ReturnRequest, ReturnRequestEvent } from "../domain/index.js";
import type {
  ReturnRequestRepository,
  ReturnsOutboxRepository,
  ReturnsUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createFakeUow(): {
  uow: ReturnsUnitOfWork;
  returns: ReturnRequest[];
  outboxEvents: ReturnRequestEvent[];
} {
  const returnState: ReturnRequest[] = [];
  const outboxEvents: ReturnRequestEvent[] = [];

  function findBy(predicate: (returnRequest: ReturnRequest) => boolean): ReturnRequest | null {
    return returnState.find(predicate) ?? null;
  }

  const returns: ReturnRequestRepository = {
    findById: async (id) => findBy((returnRequest) => returnRequest.id === id),
    findByIdForUpdate: async (id) => findBy((returnRequest) => returnRequest.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((returnRequest) => returnRequest.idempotencyKey === idempotencyKey),
    create: async (returnRequest) => {
      returnState.push(returnRequest);
    },
    save: async (returnRequest) => {
      const index = returnState.findIndex((current) => current.id === returnRequest.id);
      if (index === -1) {
        throw new Error("return request missing");
      }
      returnState[index] = returnRequest;
    },
  };

  const outbox: ReturnsOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ returns, outbox });
      },
    },
    returns: returnState,
    outboxEvents,
  };
}

async function createReturnFixture(fake: ReturnType<typeof createFakeUow>): Promise<void> {
  const createReturn = createCreateReturnRequestUseCase({
    uow: fake.uow,
    now: () => now,
    generateId: () => "return-1",
  });
  const result = await createReturn({
    orderId: "order-1",
    fulfillmentId: "fulfillment-1",
    idempotencyKey: "return-request-1",
    reason: "wrong size",
    items: [{ sku: "sku-1", quantity: 2 }],
  });
  if (!result.ok) {
    throw new Error("expected return fixture to be created");
  }
}

describe("returns usecases", () => {
  it("creates return requests idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const createReturn = createCreateReturnRequestUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "return-1",
    });

    const first = await createReturn({
      orderId: "order-1",
      fulfillmentId: "fulfillment-1",
      idempotencyKey: "return-request-1",
      reason: "wrong size",
      items: [{ sku: "sku-1", quantity: 2 }],
    });
    const second = await createReturn({
      orderId: "order-1",
      fulfillmentId: "fulfillment-1",
      idempotencyKey: "return-request-1",
      reason: "wrong size",
      items: [{ sku: "sku-1", quantity: 2 }],
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected return creation to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.returns).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["ReturnRequested"]);
  });

  it("authorizes once and treats later authorization calls as idempotent", async () => {
    const fake = createFakeUow();
    await createReturnFixture(fake);
    const authorize = createAuthorizeReturnUseCase({
      uow: fake.uow,
      now: () => later,
      generateRmaNumber: () => "RMA-1",
    });

    const first = await authorize({ returnId: "return-1" });
    const second = await authorize({ returnId: "return-1" });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected authorization to succeed");
    }
    expect(first.value.returnRequest.rmaNumber).toBe("RMA-1");
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "ReturnRequested",
      "ReturnAuthorized",
    ]);
  });

  it("does not receive a return before authorization", async () => {
    const fake = createFakeUow();
    await createReturnFixture(fake);
    const receive = createReceiveReturnUseCase({
      uow: fake.uow,
      now: () => later,
    });

    const result = await receive({ returnId: "return-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected receive to fail");
    }
    expect(result.error.type).toBe("ReturnNotReceivable");
  });
});
