import { describe, expect, it } from "vitest";
import {
  createGetSettlementUseCase,
  createSyncPendingSettlementsUseCase,
  createSyncSettlementUseCase,
} from "../application/index.js";
import type { Settlement, SettlementEvent, SettlementSourceFacts } from "../domain/index.js";
import type {
  SettlementOutboxRepository,
  SettlementRepository,
  SettlementSourceReader,
  SettlementUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const amount = { amount: 10_000, currency: "KRW" } as const;

function createFacts(orderId: string): SettlementSourceFacts {
  return {
    orderId,
    payment: {
      paymentId: "payment-1",
      amount,
      authorizedAt: now,
    },
    refunds: [],
    fulfillment: {
      fulfillmentId: "fulfillment-1",
      deliveredAt: new Date("2026-01-02T00:00:00.000Z"),
    },
  };
}

function createFakeUow(initialSettlements: readonly Settlement[] = []): {
  uow: SettlementUnitOfWork;
  settlements: Settlement[];
  outboxEvents: SettlementEvent[];
} {
  const settlementState: Settlement[] = [...initialSettlements];
  const outboxEvents: SettlementEvent[] = [];

  function findBy(predicate: (settlement: Settlement) => boolean): Settlement | null {
    return settlementState.find(predicate) ?? null;
  }

  const settlements: SettlementRepository = {
    findById: async (id) => findBy((settlement) => settlement.id === id),
    findByOrderId: async (orderId) => findBy((settlement) => settlement.orderId === orderId),
    findByOrderIdForUpdate: async (orderId) =>
      findBy((settlement) => settlement.orderId === orderId),
    create: async (settlement) => {
      settlementState.push(settlement);
    },
    save: async (settlement) => {
      const index = settlementState.findIndex((existing) => existing.id === settlement.id);
      if (index === -1) {
        throw new Error("settlement missing");
      }
      settlementState[index] = settlement;
    },
  };

  const outbox: SettlementOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ settlements, outbox });
      },
    },
    settlements: settlementState,
    outboxEvents,
  };
}

function createSourceReader(
  factsByOrderId: ReadonlyMap<string, SettlementSourceFacts>,
): SettlementSourceReader {
  return {
    async findFactsByOrderId(orderId) {
      return (
        factsByOrderId.get(orderId) ?? {
          orderId,
          payment: null,
          refunds: [],
          fulfillment: null,
        }
      );
    },
    async *iterateCandidateOrderIds(options) {
      let yielded = 0;
      for (const orderId of factsByOrderId.keys()) {
        if (yielded >= options.batchSize) {
          return;
        }
        yielded += 1;
        yield orderId;
      }
    },
  };
}

describe("settlement usecases", () => {
  it("syncs one order into a ready settlement and writes outbox events", async () => {
    const fake = createFakeUow();
    const sync = createSyncSettlementUseCase({
      sourceReader: createSourceReader(new Map([["order-1", createFacts("order-1")]])),
      uow: fake.uow,
      now: () => now,
    });

    const result = await sync({ orderId: "order-1" });

    expect(result.ok).toBe(true);
    expect(fake.settlements[0]?.status).toBe("READY");
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "SettlementOpened",
      "SettlementMarkedReady",
    ]);
  });

  it("returns a business error when authorized payment source facts are missing", async () => {
    const fake = createFakeUow();
    const sync = createSyncSettlementUseCase({
      sourceReader: createSourceReader(new Map()),
      uow: fake.uow,
      now: () => now,
    });

    const result = await sync({ orderId: "missing-order" });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "SettlementSourcePaymentMissing",
        orderId: "missing-order",
        message: "Settlement requires an authorized payment source event",
      },
    });
  });

  it("gets settlement projections by order id", async () => {
    const fake = createFakeUow();
    const sync = createSyncSettlementUseCase({
      sourceReader: createSourceReader(new Map([["order-1", createFacts("order-1")]])),
      uow: fake.uow,
      now: () => now,
    });
    await sync({ orderId: "order-1" });
    const getSettlement = createGetSettlementUseCase({ uow: fake.uow });

    const result = await getSettlement({ orderId: "order-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected settlement lookup to succeed");
    }
    expect(result.value.orderId).toBe("order-1");
  });

  it("scans candidate orders with a bounded batch size", async () => {
    const fake = createFakeUow();
    const sourceReader = createSourceReader(
      new Map([
        ["order-1", createFacts("order-1")],
        ["order-2", createFacts("order-2")],
      ]),
    );
    const syncOne = createSyncSettlementUseCase({
      sourceReader,
      uow: fake.uow,
      now: () => now,
    });
    const syncPending = createSyncPendingSettlementsUseCase({ sourceReader, syncOne });

    const result = await syncPending({ batchSize: 1 });

    expect(result).toEqual({
      ok: true,
      value: { scanned: 1, synced: 1, failed: 0 },
    });
    expect(fake.settlements.map((settlement) => settlement.orderId)).toEqual(["order-1"]);
  });
});
