import { describe, expect, it } from "vitest";
import type { ActiveInventoryReservation, InventoryItem } from "../domain/index.js";
import {
  commitReservation,
  expireReservation,
  releaseReservation,
  reserveInventory,
} from "../domain/index.js";

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

function createActiveReservation(
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

describe("inventory domain behavior", () => {
  it("reserves available inventory and returns an event", () => {
    const result = reserveInventory(createItem(), {
      reservationId: "reservation-1",
      idempotencyKey: "idem-1",
      quantity: 3,
      expiresAt,
      now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected reservation to succeed");
    }

    expect(result.value.item.reserved).toBe(3);
    expect(result.value.reservation.status).toBe("ACTIVE");
    expect(result.value.events[0]?.type).toBe("InventoryReserved");
  });

  it("rejects reservations that exceed available quantity", () => {
    const result = reserveInventory(createItem({ onHand: 5, reserved: 4 }), {
      reservationId: "reservation-1",
      idempotencyKey: "idem-1",
      quantity: 2,
      expiresAt,
      now,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        type: "InsufficientInventory",
        available: 1,
        requested: 2,
        message: "Insufficient inventory available",
      },
    });
  });

  it("releases an active reservation and decrements reserved quantity", () => {
    const result = releaseReservation(createItem({ reserved: 2 }), createActiveReservation(), now);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected release to succeed");
    }

    expect(result.value.item.reserved).toBe(0);
    expect(result.value.reservation.status).toBe("RELEASED");
    expect(result.value.reservation.releasedAt).toEqual(now);
  });

  it("commits an active reservation by reducing on-hand and reserved quantity", () => {
    const result = commitReservation(
      createItem({ onHand: 10, reserved: 2 }),
      createActiveReservation(),
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected commit to succeed");
    }

    expect(result.value.item.onHand).toBe(8);
    expect(result.value.item.reserved).toBe(0);
    expect(result.value.reservation.status).toBe("COMMITTED");
  });

  it("expires only active reservations whose expiry has passed", () => {
    const result = expireReservation(
      createItem({ reserved: 2 }),
      createActiveReservation({ expiresAt: new Date("2025-12-31T00:00:00.000Z") }),
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected expiration to succeed");
    }

    expect(result.value.item.reserved).toBe(0);
    expect(result.value.reservation.status).toBe("EXPIRED");
    expect(result.value.events[0]?.type).toBe("InventoryReservationExpired");
  });
});
