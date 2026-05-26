# Transaction Policy

Transactions are explicit and owned by application orchestration through a unit-of-work port.

Rules:

- Usecases decide transaction boundaries.
- Repositories receive a transaction-bound executor from the unit of work.
- Do not pass Kysely objects into domain or application code.
- Do not hold a transaction open around external publishing, HTTP calls, or slow queue operations.
- Append domain events, update projections, and write outbox rows in the same short transaction.
- Use outbox rows for reliable external publication after state changes; do not use outbox rows as
  the event store.

The order, payment, inventory, fulfillment, and refund modules demonstrate `UnitOfWork` boundaries.
The payment module keeps Toss Payments HTTP calls outside DB transactions, then records the resulting
domain event, projection update, and outbox event in a short transaction.

The checkout module demonstrates cross-module orchestration through application ports. It validates
the order before side effects, calls inventory/payment/order usecases through adapters, and records
compensation outcomes instead of stretching one database transaction across module and provider
boundaries.
