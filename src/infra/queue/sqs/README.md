# SQS Adapter Stub

SQS is the recommended managed queue backend for AWS production deployments. Keep the same
`EventPublisher` or `QueuePublisher` port and implement SQS as an adapter under this directory.

Production notes:

- Set a visibility timeout longer than the normal handler duration.
- Configure retries and a dead-letter queue.
- Use idempotent consumers because at-least-once delivery is expected.
- Keep AWS SDK types out of domain and application code.
