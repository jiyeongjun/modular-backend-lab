# MSK Event Stream Adapter Stub

MSK is the managed Kafka-compatible event streaming backbone candidate for mature event-driven MSA
deployments. It is not the default local runtime and is not required for local smoke tests or quality
gates.

Use this boundary only when event streaming semantics are required:

- Multiple independent consumer groups need the same domain events.
- Consumers need replay from retained event streams.
- Topic, partition, schema version, retry, dead-letter, and lag monitoring policies are documented.
- The extra managed service cost and operational complexity are justified.

Repository rules:

- Do not put Kafka/MSK clients in domain, application, ports, jobs, or HTTP code.
- Do not treat MSK as the event source of truth. `domain_events` remains the business ledger.
- Publish to MSK from an outbox publisher or event-stream adapter after the database transaction
  commits.
- Keep local development runnable through BullMQ plus Valkey unless a separate optional local Kafka
  profile is intentionally added.
- Do not add Kafka client dependencies, topics, MSK resources, Terraform, Helm, CDK, or Pulumi from
  this stub alone.
