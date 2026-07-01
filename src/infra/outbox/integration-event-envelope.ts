export type IntegrationEventEnvelopeMetadata = Readonly<Record<string, unknown>>;

export type IntegrationEventEnvelope<
  TPayload = unknown,
  TMetadata extends IntegrationEventEnvelopeMetadata = IntegrationEventEnvelopeMetadata,
> = Readonly<{
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  producer: string;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  payload: TPayload;
  metadata?: TMetadata;
}>;

export type IntegrationEventEnvelopeSource = Readonly<{
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
  payload: unknown;
}>;
