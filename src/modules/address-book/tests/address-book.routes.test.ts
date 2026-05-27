import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  AddAddressUseCase,
  DisableAddressUseCase,
  SetDefaultAddressUseCase,
  UpdateAddressUseCase,
} from "../application/index.js";
import type { ActiveAddress, DisabledAddress } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createActiveAddress(): ActiveAddress {
  return {
    id: "address-1",
    customerId: "customer-1",
    idempotencyKey: "address-add-1",
    purpose: "SHIPPING",
    status: "ACTIVE",
    label: "Home",
    recipientName: "Kim",
    phone: "010-0000-0000",
    line1: "Seoul road 1",
    line2: null,
    city: "Seoul",
    region: null,
    postalCode: "12345",
    country: "KR",
    isDefault: false,
    disabledAt: null,
    disableReason: null,
    addedAt: now,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createDisabledAddress(): DisabledAddress {
  return {
    ...createActiveAddress(),
    status: "DISABLED",
    isDefault: false,
    disabledAt: later,
    disableReason: "customer requested removal",
    updatedAt: later,
  };
}

function createTestApp(overrides: {
  addAddressUseCase?: AddAddressUseCase;
  updateAddressUseCase?: UpdateAddressUseCase;
  setDefaultAddressUseCase?: SetDefaultAddressUseCase;
  disableAddressUseCase?: DisableAddressUseCase;
}) {
  return createRouteTestApp({
    addAddressUseCase:
      overrides.addAddressUseCase ??
      (async () => ok({ address: createActiveAddress(), idempotent: false })),
    updateAddressUseCase:
      overrides.updateAddressUseCase ??
      (async () => ok({ address: createActiveAddress(), idempotent: false })),
    setDefaultAddressUseCase:
      overrides.setDefaultAddressUseCase ??
      (async () =>
        ok({ address: { ...createActiveAddress(), isDefault: true }, idempotent: false })),
    disableAddressUseCase:
      overrides.disableAddressUseCase ??
      (async () => ok({ address: createDisabledAddress(), idempotent: false })),
  });
}

function validAddressBody(): string {
  return JSON.stringify({
    customerId: "customer-1",
    idempotencyKey: "address-add-1",
    purpose: "SHIPPING",
    makeDefault: true,
    label: "Home",
    recipientName: "Kim",
    phone: "010-0000-0000",
    line1: "Seoul road 1",
    line2: null,
    city: "Seoul",
    region: null,
    postalCode: "12345",
    country: "KR",
  });
}

describe("address-book routes", () => {
  it("returns 201 when address is added", async () => {
    const app = createTestApp({});

    const response = await app.request("/address-book/addresses", {
      method: "POST",
      body: validAddressBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid address body", async () => {
    const app = createTestApp({});

    const response = await app.request("/address-book/addresses", {
      method: "POST",
      body: JSON.stringify({ ...JSON.parse(validAddressBody()), recipientName: "" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 200 when address is updated", async () => {
    const app = createTestApp({});

    const response = await app.request("/address-book/addresses/address-1", {
      method: "PATCH",
      body: JSON.stringify({
        label: "Office",
        recipientName: "Kim",
        phone: "010-1111-1111",
        line1: "Busan road 2",
        line2: "10F",
        city: "Busan",
        region: null,
        postalCode: "54321",
        country: "KR",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });

  it("maps missing address to 404", async () => {
    const app = createTestApp({
      setDefaultAddressUseCase: async () =>
        err({
          type: "AddressNotFound",
          addressId: "missing-address",
          message: "Address was not found",
        }),
    });

    const response = await app.request("/address-book/addresses/missing-address/default", {
      method: "POST",
    });

    expect(response.status).toBe(404);
  });

  it("returns 200 when address is disabled", async () => {
    const app = createTestApp({});

    const response = await app.request("/address-book/addresses/address-1/disable", {
      method: "POST",
      body: JSON.stringify({ reason: "customer requested removal" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(200);
  });
});
