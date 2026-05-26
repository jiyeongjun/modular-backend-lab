import { describe, expect, it } from "vitest";
import { ok } from "../../../shared/result/index.js";
import {
  createCreateFulfillmentUseCase,
  createMarkFulfillmentPackedUseCase,
  createPurchaseShippingLabelUseCase,
  createSyncFulfillmentCarrierStatusUseCase,
  createSyncFulfillmentStatusesUseCase,
} from "../application/index.js";
import type { Fulfillment, FulfillmentEvent } from "../domain/index.js";
import type {
  FulfillmentOutboxRepository,
  FulfillmentReader,
  FulfillmentRepository,
  FulfillmentUnitOfWork,
  ShippingCarrier,
} from "../ports/index.js";

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

function createFakeUow(initialFulfillments: readonly Fulfillment[] = []): {
  uow: FulfillmentUnitOfWork;
  fulfillments: Fulfillment[];
  events: FulfillmentEvent[];
} {
  const fulfillmentState: Fulfillment[] = [...initialFulfillments];
  const events: FulfillmentEvent[] = [];

  function findBy(predicate: (fulfillment: Fulfillment) => boolean): Fulfillment | null {
    return fulfillmentState.find(predicate) ?? null;
  }

  const fulfillments: FulfillmentRepository = {
    findById: async (id) => findBy((fulfillment) => fulfillment.id === id),
    findByIdForUpdate: async (id) => findBy((fulfillment) => fulfillment.id === id),
    findByOrderId: async (orderId) => findBy((fulfillment) => fulfillment.orderId === orderId),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((fulfillment) => fulfillment.idempotencyKey === idempotencyKey),
    findByLabelIdempotencyKey: async (idempotencyKey) =>
      findBy((fulfillment) => fulfillment.labelIdempotencyKey === idempotencyKey),
    create: async (fulfillment) => {
      fulfillmentState.push(fulfillment);
    },
    save: async (fulfillment) => {
      const index = fulfillmentState.findIndex((existing) => existing.id === fulfillment.id);
      if (index === -1) {
        throw new Error("fulfillment missing");
      }
      fulfillmentState[index] = fulfillment;
    },
  };

  const outbox: FulfillmentOutboxRepository = {
    saveAll: async (newEvents) => {
      events.push(...newEvents);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ fulfillments, outbox });
      },
    },
    fulfillments: fulfillmentState,
    events,
  };
}

function createCarrier(
  status: "CREATED" | "IN_TRANSIT" | "DELIVERED" = "IN_TRANSIT",
): ShippingCarrier {
  return {
    async purchaseLabel(command) {
      return ok({
        carrier: "LOCAL_TEST_CARRIER",
        carrierShipmentId: `carrier-${command.fulfillmentId}`,
        trackingNumber: `tracking-${command.fulfillmentId}`,
        carrierStatus: "CREATED",
        purchasedAt: later,
      });
    },
    async getShipmentStatus() {
      return ok({ carrierStatus: status, occurredAt: later });
    },
  };
}

async function createPackedFulfillment(): Promise<{
  fulfillment: Fulfillment;
  fake: ReturnType<typeof createFakeUow>;
}> {
  const fake = createFakeUow();
  const create = createCreateFulfillmentUseCase({
    uow: fake.uow,
    now: () => now,
    generateId: () => "fulfillment-1",
  });
  const pack = createMarkFulfillmentPackedUseCase({
    uow: fake.uow,
    now: () => later,
  });

  const created = await create({
    orderId: "order-1",
    idempotencyKey: "create-1",
    recipient,
    package: shipmentPackage,
  });
  if (!created.ok) {
    throw new Error("expected fulfillment to be created");
  }

  const packed = await pack({ fulfillmentId: created.value.fulfillment.id });
  if (!packed.ok) {
    throw new Error("expected fulfillment to be packed");
  }

  return { fulfillment: packed.value.fulfillment, fake };
}

async function createLabeledFulfillment(): Promise<{
  fulfillment: Fulfillment;
  fake: ReturnType<typeof createFakeUow>;
}> {
  const packed = await createPackedFulfillment();
  const purchaseLabel = createPurchaseShippingLabelUseCase({
    uow: packed.fake.uow,
    carrier: createCarrier(),
    now: () => later,
  });
  const labeled = await purchaseLabel({
    fulfillmentId: "fulfillment-1",
    idempotencyKey: "label-1",
  });

  if (!labeled.ok) {
    throw new Error("expected label to be purchased");
  }

  return { fulfillment: labeled.value.fulfillment, fake: packed.fake };
}

describe("fulfillment usecases", () => {
  it("creates, packs, purchases a label, and writes outbox events", async () => {
    const { fake } = await createPackedFulfillment();
    const purchaseLabel = createPurchaseShippingLabelUseCase({
      uow: fake.uow,
      carrier: createCarrier(),
      now: () => later,
    });

    const result = await purchaseLabel({
      fulfillmentId: "fulfillment-1",
      idempotencyKey: "label-1",
    });

    expect(result.ok).toBe(true);
    expect(fake.fulfillments[0]?.status).toBe("LABEL_PURCHASED");
    expect(fake.events.map((event) => event.type)).toEqual([
      "FulfillmentCreated",
      "FulfillmentPacked",
      "ShippingLabelPurchased",
    ]);
  });

  it("syncs carrier status and marks labeled fulfillments shipped", async () => {
    const { fake } = await createPackedFulfillment();
    const purchaseLabel = createPurchaseShippingLabelUseCase({
      uow: fake.uow,
      carrier: createCarrier(),
      now: () => later,
    });
    const labeled = await purchaseLabel({
      fulfillmentId: "fulfillment-1",
      idempotencyKey: "label-1",
    });
    if (!labeled.ok) {
      throw new Error("expected label to be purchased");
    }

    const sync = createSyncFulfillmentCarrierStatusUseCase({
      uow: fake.uow,
      carrier: createCarrier("IN_TRANSIT"),
      now: () => later,
    });

    const result = await sync({ fulfillmentId: "fulfillment-1" });

    expect(result.ok).toBe(true);
    expect(fake.fulfillments[0]?.status).toBe("SHIPPED");
    expect(fake.events.at(-1)?.type).toBe("FulfillmentShipped");
  });

  it("streams trackable fulfillments through the batch sync usecase", async () => {
    const labeled = await createLabeledFulfillment();
    const trackable = labeled.fulfillment;
    if (trackable.status !== "LABEL_PURCHASED") {
      throw new Error("expected trackable fulfillment");
    }

    const reader: FulfillmentReader = {
      async *iterateTrackable(options) {
        expect(options.batchSize).toBe(10);
        yield trackable;
      },
    };
    const syncMany = createSyncFulfillmentStatusesUseCase({
      reader,
      syncOne: async () => ok({ fulfillment: trackable, updated: true }),
    });

    const result = await syncMany({ batchSize: 10 });

    expect(result).toEqual({ ok: true, value: { scanned: 1, updated: 1, failed: 0 } });
  });
});
