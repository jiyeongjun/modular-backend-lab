# Transaction Policy

Transactions are explicit and owned by application orchestration through a unit-of-work port.

Rules:

- Usecases decide transaction boundaries.
- Repositories receive a transaction-bound executor from the unit of work.
- Do not pass Kysely objects into domain or application code.
- Do not hold a transaction open around external publishing, HTTP calls, or slow queue operations.
- Use outbox rows for reliable external publication after state changes.

The order and payment modules demonstrate `UnitOfWork` boundaries. The payment module keeps Toss
Payments HTTP calls outside DB transactions, then records the resulting state transition and outbox
event in a short transaction.
