import { describe, expect, it } from "vitest";
import type { IntegrationEventEnvelopeSource } from "./integration-event-envelope.js";
import { toIntegrationEventEnvelope } from "./integration-event-envelope.mapper.js";

const occurredAt = new Date("2026-01-01T00:00:00.000Z");

function createEnvelopeSource(
  overrides: Partial<IntegrationEventEnvelopeSource> = {},
): IntegrationEventEnvelopeSource {
  return {
    id: "outbox-event-1",
    eventType: "OrderPaid",
    aggregateType: "Order",
    aggregateId: "order-1",
    occurredAt,
    payload: { rawOutboxPayload: true },
    ...overrides,
  };
}

describe("toIntegrationEventEnvelope", () => {
  it("maps required external envelope fields", () => {
    const envelope = toIntegrationEventEnvelope({
      event: createEnvelopeSource(),
      eventVersion: 1,
      producer: "modular-backend-lab",
      payload: { orderId: "order-1" },
    });

    expect(envelope).toEqual({
      eventId: "outbox-event-1",
      eventType: "OrderPaid",
      eventVersion: 1,
      aggregateType: "Order",
      aggregateId: "order-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      producer: "modular-backend-lab",
      payload: { orderId: "order-1" },
    });
  });

  it("does not invent optional or conditional fields", () => {
    const envelope = toIntegrationEventEnvelope({
      event: createEnvelopeSource(),
      eventVersion: 1,
      producer: "modular-backend-lab",
      payload: { orderId: "order-1" },
    });

    expect(envelope).not.toHaveProperty("correlationId");
    expect(envelope).not.toHaveProperty("causationId");
    expect(envelope).not.toHaveProperty("idempotencyKey");
    expect(envelope).not.toHaveProperty("metadata");
  });

  it("uses the explicitly mapped external payload instead of the internal outbox payload", () => {
    const source = createEnvelopeSource({
      payload: {
        idempotencyKey: "raw-idempotency-key",
        rawDbOnlyField: "not-external",
      },
    });
    const externalPayload = { orderId: "order-1", paidAt: "2026-01-01T00:00:00.000Z" };

    const envelope = toIntegrationEventEnvelope({
      event: source,
      eventVersion: 1,
      producer: "modular-backend-lab",
      payload: externalPayload,
    });

    expect(envelope.payload).toEqual(externalPayload);
    expect(envelope.payload).not.toEqual(source.payload);
    expect(envelope).not.toHaveProperty("idempotencyKey");
  });

  it("preserves an explicitly mapped idempotency key", () => {
    const envelope = toIntegrationEventEnvelope({
      event: createEnvelopeSource(),
      eventVersion: 1,
      producer: "modular-backend-lab",
      payload: { orderId: "order-1" },
      idempotencyKey: "checkout-1",
    });

    expect(envelope.idempotencyKey).toBe("checkout-1");
  });
});
