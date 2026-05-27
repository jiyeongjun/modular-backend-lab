import { describe, expect, it } from "vitest";
import {
  createAddAddressUseCase,
  createDisableAddressUseCase,
  createSetDefaultAddressUseCase,
  createUpdateAddressUseCase,
} from "../application/index.js";
import type { Address, AddressEvent, AddressPurpose } from "../domain/index.js";
import type {
  AddressBookUnitOfWork,
  AddressOutboxRepository,
  AddressRepository,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createFakeUow(): {
  uow: AddressBookUnitOfWork;
  addresses: Address[];
  outboxEvents: AddressEvent[];
} {
  const addressState: Address[] = [];
  const outboxEvents: AddressEvent[] = [];

  function findBy(predicate: (address: Address) => boolean): Address | null {
    return addressState.find(predicate) ?? null;
  }

  const addresses: AddressRepository = {
    findById: async (id) => findBy((address) => address.id === id),
    findByIdForUpdate: async (id) => findBy((address) => address.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((address) => address.idempotencyKey === idempotencyKey),
    findDefault: async (customerId, purpose) =>
      findBy(
        (address) =>
          address.customerId === customerId &&
          address.purpose === purpose &&
          address.status === "ACTIVE" &&
          address.isDefault,
      ),
    clearDefaultForCustomerPurpose: async (customerId, purpose, exceptAddressId) => {
      for (let index = 0; index < addressState.length; index += 1) {
        const address = addressState[index];
        if (
          address !== undefined &&
          address.customerId === customerId &&
          address.purpose === purpose &&
          address.id !== exceptAddressId &&
          address.status === "ACTIVE" &&
          address.isDefault
        ) {
          addressState[index] = { ...address, isDefault: false, updatedAt: later };
        }
      }
    },
    create: async (address) => {
      addressState.push(address);
    },
    save: async (address) => {
      const index = addressState.findIndex((current) => current.id === address.id);
      if (index === -1) {
        throw new Error("address missing");
      }
      addressState[index] = address;
    },
  };

  const outbox: AddressOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ addresses, outbox });
      },
    },
    addresses: addressState,
    outboxEvents,
  };
}

function addressCommand(
  overrides: Partial<{ idempotencyKey: string; purpose: AddressPurpose }> = {},
) {
  return {
    customerId: "customer-1",
    idempotencyKey: overrides.idempotencyKey ?? "address-add-1",
    purpose: overrides.purpose ?? ("SHIPPING" as const),
    makeDefault: false,
    label: "Home",
    recipientName: "Kim",
    phone: "010-0000-0000",
    line1: "Seoul road 1",
    line2: null,
    city: "Seoul",
    region: null,
    postalCode: "12345",
    country: "KR",
  };
}

describe("address-book usecases", () => {
  it("adds addresses idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const addAddress = createAddAddressUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "address-1",
    });

    const first = await addAddress(addressCommand());
    const second = await addAddress(addressCommand());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected address creation to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.addresses).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["AddressAdded"]);
  });

  it("sets only one default address per customer and purpose", async () => {
    const fake = createFakeUow();
    let nextId = 1;
    const addAddress = createAddAddressUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => `address-${nextId++}`,
    });
    const setDefault = createSetDefaultAddressUseCase({
      uow: fake.uow,
      now: () => later,
    });

    await addAddress({ ...addressCommand(), makeDefault: true });
    await addAddress(addressCommand({ idempotencyKey: "address-add-2" }));
    const result = await setDefault({ addressId: "address-2" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected default address to be changed");
    }
    expect(fake.addresses.filter((address) => address.isDefault)).toHaveLength(1);
    expect(fake.addresses.find((address) => address.id === "address-2")?.isDefault).toBe(true);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "AddressAdded",
      "DefaultAddressChanged",
      "AddressAdded",
      "DefaultAddressChanged",
    ]);
  });

  it("updates and disables active addresses", async () => {
    const fake = createFakeUow();
    const addAddress = createAddAddressUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "address-1",
    });
    const update = createUpdateAddressUseCase({
      uow: fake.uow,
      now: () => later,
    });
    const disable = createDisableAddressUseCase({
      uow: fake.uow,
      now: () => later,
    });

    await addAddress(addressCommand());
    const updated = await update({
      addressId: "address-1",
      label: "Office",
      recipientName: "Kim",
      phone: "010-1111-1111",
      line1: "Busan road 2",
      line2: "10F",
      city: "Busan",
      region: null,
      postalCode: "54321",
      country: "KR",
    });
    const disabled = await disable({
      addressId: "address-1",
      reason: "customer requested removal",
    });

    expect(updated.ok).toBe(true);
    expect(disabled.ok).toBe(true);
    if (!updated.ok || !disabled.ok) {
      throw new Error("expected address updates to succeed");
    }
    expect(updated.value.address.city).toBe("Busan");
    expect(disabled.value.address.status).toBe("DISABLED");
  });
});
