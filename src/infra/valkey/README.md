# Valkey

Local development uses Valkey as a Redis-compatible backend for BullMQ.

The codebase treats Valkey through Redis-compatible client behavior only. Do not introduce
Valkey-specific APIs unless the architecture decision is documented in `docs/09-architecture-decisions.md`.
