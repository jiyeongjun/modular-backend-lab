import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type TimestampColumn = ColumnType<Date, Date | string, Date | string>;

export type OrdersTable = {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  paid_at: TimestampColumn | null;
  version: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type OutboxEventsTable = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  occurred_at: TimestampColumn;
  processed_at: TimestampColumn | null;
  created_at: TimestampColumn;
};

export type KyselyMigrationTable = {
  name: string;
  timestamp: TimestampColumn;
};

export type KyselyMigrationLockTable = {
  id: Generated<string>;
  is_locked: number;
};

export type Database = {
  orders: OrdersTable;
  outbox_events: OutboxEventsTable;
  kysely_migration: KyselyMigrationTable;
  kysely_migration_lock: KyselyMigrationLockTable;
};

export type OrderRow = Selectable<OrdersTable>;
export type OrderInsert = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;
export type OutboxEventRow = Selectable<OutboxEventsTable>;
export type OutboxEventInsert = Insertable<OutboxEventsTable>;
