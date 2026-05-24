export type QueueMessage<TPayload = unknown> = Readonly<{
  id: string;
  name: string;
  payload: TPayload;
}>;
