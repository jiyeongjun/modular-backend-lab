import type {
  IntegrationEventEnvelope,
  IntegrationEventEnvelopeMetadata,
  IntegrationEventEnvelopeSource,
} from "./integration-event-envelope.js";

export type IntegrationEventEnvelopeMapping<
  TPayload,
  TMetadata extends IntegrationEventEnvelopeMetadata = IntegrationEventEnvelopeMetadata,
> = Readonly<{
  event: IntegrationEventEnvelopeSource;
  eventVersion: number;
  producer: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  metadata?: TMetadata;
}>;

export function toIntegrationEventEnvelope<
  TPayload,
  TMetadata extends IntegrationEventEnvelopeMetadata = IntegrationEventEnvelopeMetadata,
>(
  mapping: IntegrationEventEnvelopeMapping<TPayload, TMetadata>,
): IntegrationEventEnvelope<TPayload, TMetadata> {
  return {
    eventId: mapping.event.id,
    eventType: mapping.event.eventType,
    eventVersion: mapping.eventVersion,
    aggregateType: mapping.event.aggregateType,
    aggregateId: mapping.event.aggregateId,
    occurredAt: mapping.event.occurredAt.toISOString(),
    producer: mapping.producer,
    ...(mapping.correlationId === undefined ? {} : { correlationId: mapping.correlationId }),
    ...(mapping.causationId === undefined ? {} : { causationId: mapping.causationId }),
    ...(mapping.idempotencyKey === undefined ? {} : { idempotencyKey: mapping.idempotencyKey }),
    payload: mapping.payload,
    ...(mapping.metadata === undefined ? {} : { metadata: mapping.metadata }),
  };
}
