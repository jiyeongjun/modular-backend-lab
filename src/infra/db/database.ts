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

export type InventoryItemsTable = {
  sku: string;
  on_hand: number;
  reserved: number;
  version: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type InventoryReservationsTable = {
  id: string;
  sku: string;
  idempotency_key: string;
  quantity: number;
  status: string;
  expires_at: TimestampColumn;
  released_at: TimestampColumn | null;
  committed_at: TimestampColumn | null;
  expired_at: TimestampColumn | null;
  version: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type PaymentsTable = {
  id: string;
  order_id: string;
  provider: string;
  provider_payment_key: string;
  confirm_idempotency_key: string;
  cancel_idempotency_key: string | null;
  status: string;
  amount: number;
  currency: string;
  provider_status: string | null;
  method: string | null;
  receipt_url: string | null;
  failure_code: string | null;
  failure_message: string | null;
  cancel_reason: string | null;
  authorized_at: TimestampColumn | null;
  failed_at: TimestampColumn | null;
  cancelled_at: TimestampColumn | null;
  version: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
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
  inventory_items: InventoryItemsTable;
  inventory_reservations: InventoryReservationsTable;
  orders: OrdersTable;
  outbox_events: OutboxEventsTable;
  payments: PaymentsTable;
  kysely_migration: KyselyMigrationTable;
  kysely_migration_lock: KyselyMigrationLockTable;
};

export type OrderRow = Selectable<OrdersTable>;
export type OrderInsert = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;
export type OutboxEventRow = Selectable<OutboxEventsTable>;
export type OutboxEventInsert = Insertable<OutboxEventsTable>;
export type InventoryItemRow = Selectable<InventoryItemsTable>;
export type InventoryItemInsert = Insertable<InventoryItemsTable>;
export type InventoryItemUpdate = Updateable<InventoryItemsTable>;
export type InventoryReservationRow = Selectable<InventoryReservationsTable>;
export type InventoryReservationInsert = Insertable<InventoryReservationsTable>;
export type InventoryReservationUpdate = Updateable<InventoryReservationsTable>;
export type PaymentRow = Selectable<PaymentsTable>;
export type PaymentInsert = Insertable<PaymentsTable>;
export type PaymentUpdate = Updateable<PaymentsTable>;
