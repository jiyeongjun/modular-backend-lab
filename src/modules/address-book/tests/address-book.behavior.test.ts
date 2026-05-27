import { describe, expect, it } from "vitest";
import {
  createAddress,
  disableAddress,
  setDefaultAddress,
  updateAddress,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function validAddressInput() {
  return {
    id: "address-1",
    customerId: "customer-1",
    idempotencyKey: "address-add-1",
    purpose: "SHIPPING" as const,
    label: " Home ",
    recipientName: " Kim ",
    phone: "010-0000-0000",
    line1: "Seoul road 1",
    line2: null,
    city: "Seoul",
    region: null,
    postalCode: "12345",
    country: "kr",
    now,
  };
}

function createAddressFixture() {
  const created = createAddress(validAddressInput());
  if (!created.ok) {
    throw new Error("expected address to be created");
  }
  return created.value;
}

describe("address-book domain behavior", () => {
  it("adds active addresses with normalized fields", () => {
    const address = createAddressFixture();

    expect(address.status).toBe("ACTIVE");
    expect(address.label).toBe("Home");
    expect(address.recipientName).toBe("Kim");
    expect(address.country).toBe("KR");
  });

  it("updates address fields without changing customer ownership", () => {
    const updated = updateAddress(createAddressFixture(), {
      label: "Office",
      recipientName: "Kim",
      phone: "010-1111-1111",
      line1: "Busan road 2",
      line2: "10F",
      city: "Busan",
      region: null,
      postalCode: "54321",
      country: "KR",
      now: later,
    });

    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error("expected address to be updated");
    }
    expect(updated.value.address.customerId).toBe("customer-1");
    expect(updated.value.events.map((event) => event.type)).toEqual(["AddressUpdated"]);
  });

  it("marks active addresses as default for their purpose", () => {
    const result = setDefaultAddress(createAddressFixture(), {
      previousDefaultAddressId: null,
      now: later,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected address to become default");
    }
    expect(result.value.address.isDefault).toBe(true);
    expect(result.value.events.map((event) => event.type)).toEqual(["DefaultAddressChanged"]);
  });

  it("disables addresses and clears default status", () => {
    const defaulted = setDefaultAddress(createAddressFixture(), {
      previousDefaultAddressId: null,
      now,
    });
    if (!defaulted.ok) {
      throw new Error("expected address to become default");
    }

    const disabled = disableAddress(defaulted.value.address, {
      reason: "customer requested removal",
      now: later,
    });

    expect(disabled.ok).toBe(true);
    if (!disabled.ok) {
      throw new Error("expected address to be disabled");
    }
    expect(disabled.value.address.status).toBe("DISABLED");
    expect(disabled.value.address.isDefault).toBe(false);
  });
});
