import { describe, expect, it } from "vitest";
import {
  createReleaseReservationUseCase,
  createReserveInventoryUseCase,
} from "../application/index.js";
import type {
  ActiveInventoryReservation,
  InventoryEvent,
  InventoryItem,
  InventoryReservation,
} from "../domain/index.js";
import type {
  InventoryItemRepository,
  InventoryOutboxRepository,
  InventoryReservationRepository,
  InventoryUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const expiresAt = new Date("2026-01-02T00:00:00.000Z");

function createItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    sku: "sku-1",
    onHand: 10,
    reserved: 0,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createReservation(
  overrides: Partial<Omit<ActiveInventoryReservation, "status">> = {},
): ActiveInventoryReservation {
  return {
    id: "reservation-1",
    sku: "sku-1",
    idempotencyKey: "idem-1",
    quantity: 2,
    status: "ACTIVE",
    expiresAt,
    releasedAt: null,
    committedAt: null,
    expiredAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createFakeUow(input: {
  item: InventoryItem | null;
  reservation?: InventoryReservation | null;
  idempotentReservation?: InventoryReservation | null;
}): {
  uow: InventoryUnitOfWork;
  savedItems: InventoryItem[];
  createdReservations: ActiveInventoryReservation[];
  savedReservations: InventoryReservation[];
  savedEvents: InventoryEvent[];
  transactions: number;
} {
  const state: {
    savedItems: InventoryItem[];
    createdReservations: ActiveInventoryReservation[];
    savedReservations: InventoryReservation[];
    savedEvents: InventoryEvent[];
    transactions: number;
  } = {
    savedItems: [],
    createdReservations: [],
    savedReservations: [],
    savedEvents: [],
    transactions: 0,
  };

  const items: InventoryItemRepository = {
    findBySku: async () => input.item,
    findBySkuForUpdate: async () => input.item,
    save: async (item) => {
      state.savedItems.push(item);
    },
  };

  const reservations: InventoryReservationRepository = {
    findById: async () => input.reservation ?? null,
    findByIdForUpdate: async () => input.reservation ?? null,
    findByIdempotencyKey: async () => input.idempotentReservation ?? null,
    create: async (reservation) => {
      state.createdReservations.push(reservation);
    },
    save: async (reservation) => {
      state.savedReservations.push(reservation);
    },
  };

  const outbox: InventoryOutboxRepository = {
    saveAll: async (events) => {
      state.savedEvents.push(...events);
    },
  };

  return {
    get savedItems() {
      return state.savedItems;
    },
    get createdReservations() {
      return state.createdReservations;
    },
    get savedReservations() {
      return state.savedReservations;
    },
    get savedEvents() {
      return state.savedEvents;
    },
    get transactions() {
      return state.transactions;
    },
    uow: {
      async withTransaction(work) {
        state.transactions += 1;
        return work({ items, reservations, outbox });
      },
    },
  };
}

describe("inventory usecases", () => {
  it("reserves inventory, creates reservation, and writes an outbox event", async () => {
    const fake = createFakeUow({ item: createItem() });
    const reserve = createReserveInventoryUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "reservation-1",
    });

    const result = await reserve({
      sku: "sku-1",
      quantity: 2,
      idempotencyKey: "idem-1",
      expiresAt,
    });

    expect(result.ok).toBe(true);
    expect(fake.savedItems[0]?.reserved).toBe(2);
    expect(fake.createdReservations[0]?.status).toBe("ACTIVE");
    expect(fake.savedEvents[0]?.type).toBe("InventoryReserved");
    expect(fake.transactions).toBe(1);
  });

  it("returns an existing reservation for duplicate idempotency key without writing", async () => {
    const existing = createReservation();
    const fake = createFakeUow({ item: createItem(), idempotentReservation: existing });
    const reserve = createReserveInventoryUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "new-reservation",
    });

    const result = await reserve({
      sku: "sku-1",
      quantity: 2,
      idempotencyKey: "idem-1",
      expiresAt,
    });

    expect(result).toEqual({ ok: true, value: { reservation: existing, idempotent: true } });
    expect(fake.savedItems).toEqual([]);
    expect(fake.createdReservations).toEqual([]);
    expect(fake.savedEvents).toEqual([]);
  });

  it("releases an active reservation and persists the transition", async () => {
    const fake = createFakeUow({
      item: createItem({ reserved: 2 }),
      reservation: createReservation(),
    });
    const release = createReleaseReservationUseCase({ uow: fake.uow, now: () => now });

    const result = await release({ reservationId: "reservation-1" });

    expect(result.ok).toBe(true);
    expect(fake.savedItems[0]?.reserved).toBe(0);
    expect(fake.savedReservations[0]?.status).toBe("RELEASED");
    expect(fake.savedEvents[0]?.type).toBe("InventoryReservationReleased");
  });
});
