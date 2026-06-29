# SQS Adapter Stub

SQS is the simple managed queue backend candidate for AWS production deployments. Keep the same
`EventPublisher` or `QueuePublisher` port and implement SQS as an adapter under this directory.

SQS is not the event source of truth. `domain_events` remains the source-of-truth ledger, and
`outbox_events` remains the integration publishing queue.

Production notes:

- Set a visibility timeout longer than the normal handler duration.
- Configure retries and a dead-letter queue.
- Use idempotent consumers because at-least-once delivery is expected.
- Keep AWS SDK types out of domain and application code.
