import { describe, expect, it } from "vitest";
import type { IntegrationEventEnvelopeSource } from "./integration-event-envelope.js";
import { toIntegrationEventEnvelope } from "./integration-event-envelope.mapper.js";

const occurredAt = new Date("2026-01-01T00:00:00.000Z");

function createBackendNeutralOutboxSource(
  overrides: Partial<IntegrationEventEnvelopeSource> = {},
): IntegrationEventEnvelopeSource {
  return {
    id: "outbox-row-1",
    eventType: "OrderPaid",
    aggregateType: "Order",
    aggregateId: "order-1",
    occurredAt,
    payload: {
      eventVersion: 999,
      producer: "raw-outbox-row",
      rawOutboxPayload: true,
    },
    ...overrides,
  };
}

describe("toIntegrationEventEnvelope backend-neutral publisher boundary contract", () => {
  it("maps outbox row identity, event type, aggregate, and timestamp into required envelope fields", () => {
    const source = createBackendNeutralOutboxSource({
      id: "outbox-row-42",
      eventType: "PaymentConfirmed",
      aggregateType: "Payment",
      aggregateId: "payment-1",
      occurredAt: new Date("2026-02-03T04:05:06.000Z"),
    });
    const externalPayload = { paymentId: "payment-1", orderId: "order-1" };

    const envelope = toIntegrationEventEnvelope({
      event: source,
      eventVersion: 2,
      producer: "payment-service",
      payload: externalPayload,
    });

    expect(envelope).toEqual({
      eventId: "outbox-row-42",
      eventType: "PaymentConfirmed",
      eventVersion: 2,
      aggregateType: "Payment",
      aggregateId: "payment-1",
      occurredAt: "2026-02-03T04:05:06.000Z",
      producer: "payment-service",
      payload: externalPayload,
    });
  });

  it("takes eventVersion, producer, and explicit external payload from adapter boundary input", () => {
    const source = createBackendNeutralOutboxSource({
      payload: {
        eventVersion: 999,
        producer: "raw-outbox-row",
        idempotencyKey: "raw-idempotency-key",
        rawDbOnlyField: "not-external",
      },
    });
    const externalPayload = { orderId: "order-1", paidAt: "2026-01-01T00:00:00.000Z" };

    const envelope = toIntegrationEventEnvelope({
      event: source,
      eventVersion: 1,
      producer: "order-service",
      payload: externalPayload,
    });

    expect(envelope.eventVersion).toBe(1);
    expect(envelope.producer).toBe("order-service");
    expect(envelope.payload).toEqual(externalPayload);
    expect(envelope.payload).not.toEqual(source.payload);
    expect(envelope).not.toHaveProperty("idempotencyKey");
  });

  it("preserves explicitly mapped conditional and recommended fields for backend adapters", () => {
    const metadata = {
      schema: "order.events.v1",
      traceId: "trace-1",
      retention: "standard",
    };

    const envelope = toIntegrationEventEnvelope({
      event: createBackendNeutralOutboxSource(),
      eventVersion: 1,
      producer: "order-service",
      correlationId: "request-1",
      causationId: "command-1",
      idempotencyKey: "checkout-1",
      payload: { orderId: "order-1" },
      metadata,
    });

    expect(envelope).toEqual({
      eventId: "outbox-row-1",
      eventType: "OrderPaid",
      eventVersion: 1,
      aggregateType: "Order",
      aggregateId: "order-1",
      occurredAt: "2026-01-01T00:00:00.000Z",
      producer: "order-service",
      correlationId: "request-1",
      causationId: "command-1",
      idempotencyKey: "checkout-1",
      payload: { orderId: "order-1" },
      metadata,
    });
  });

  it("omits absent conditional fields instead of serializing undefined values", () => {
    const envelope = toIntegrationEventEnvelope({
      event: createBackendNeutralOutboxSource(),
      eventVersion: 1,
      producer: "order-service",
      payload: { orderId: "order-1" },
    });
    const conditionalFields = [
      "correlationId",
      "causationId",
      "idempotencyKey",
      "metadata",
    ] as const;

    for (const field of conditionalFields) {
      expect(Object.hasOwn(envelope, field)).toBe(false);
    }
    expect(Object.values(envelope)).not.toContain(undefined);
  });
});
