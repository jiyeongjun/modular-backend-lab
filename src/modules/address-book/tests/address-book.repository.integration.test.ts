import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import { addressAddedEvent, createAddress, setDefaultAddress } from "../domain/index.js";
import {
  createKyselyAddressOutboxRepository,
  createKyselyAddressRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createAddressFixture(id: string, idempotencyKey: string) {
  const created = createAddress({
    id,
    customerId: "customer-1",
    idempotencyKey,
    purpose: "SHIPPING",
    label: "Home",
    recipientName: "Kim",
    phone: "010-0000-0000",
    line1: "Seoul road 1",
    line2: null,
    city: "Seoul",
    region: null,
    postalCode: "12345",
    country: "KR",
    now,
  });
  if (!created.ok) {
    throw new Error("expected address to be created");
  }
  return created.value;
}

describe.runIf(dockerAvailable)("address-book repository integration", () => {
  it("persists address projections, domain events, outbox rows, and scoped defaults", async () => {
    await withTestDatabase(async (db) => {
      const addresses = createKyselyAddressRepository(db);
      const outbox = createKyselyAddressOutboxRepository(db);
      const first = createAddressFixture("address-1", "address-add-1");
      const firstAddedEvents = [addressAddedEvent(first)];
      await addresses.create(first, firstAddedEvents);
      await outbox.saveAll(firstAddedEvents);

      const firstDefault = setDefaultAddress(first, {
        previousDefaultAddressId: null,
        now,
      });
      if (!firstDefault.ok) {
        throw new Error("expected first address to become default");
      }
      await addresses.save(firstDefault.value.address, firstDefault.value.events);
      await outbox.saveAll(firstDefault.value.events);

      const second = createAddressFixture("address-2", "address-add-2");
      const secondAddedEvents = [addressAddedEvent(second)];
      await addresses.create(second, secondAddedEvents);
      await outbox.saveAll(secondAddedEvents);

      const secondDefault = setDefaultAddress(second, {
        previousDefaultAddressId: "address-1",
        now: later,
      });
      if (!secondDefault.ok) {
        throw new Error("expected second address to become default");
      }
      await addresses.clearDefaultForCustomerPurpose("customer-1", "SHIPPING", "address-2", later);
      await addresses.save(secondDefault.value.address, secondDefault.value.events);
      await outbox.saveAll(secondDefault.value.events);

      const defaultAddress = await addresses.findDefault("customer-1", "SHIPPING");
      const firstSaved = await addresses.findById("address-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Address")
        .orderBy("created_at", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "Address")
        .orderBy("created_at", "asc")
        .execute();

      expect(defaultAddress?.id).toBe("address-2");
      expect(firstSaved?.isDefault).toBe(false);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "AddressAdded",
        "DefaultAddressChanged",
        "AddressAdded",
        "DefaultAddressChanged",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "AddressAdded",
        "DefaultAddressChanged",
        "AddressAdded",
        "DefaultAddressChanged",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("address-book repository integration prerequisites", () => {
  it("documents that Docker is required for address-book repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
