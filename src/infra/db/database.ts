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

export type DomainEventsTable = {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  event_type: string;
  event_schema_version: number;
  payload: unknown;
  occurred_at: TimestampColumn;
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

export type InventoryRestocksTable = {
  id: string;
  sku: string;
  idempotency_key: string;
  quantity: number;
  created_at: TimestampColumn;
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

export type FulfillmentsTable = {
  id: string;
  order_id: string;
  idempotency_key: string;
  status: string;
  recipient_name: string;
  recipient_phone: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  country: string;
  weight_grams: number;
  package_description: string | null;
  label_idempotency_key: string | null;
  carrier: string | null;
  carrier_shipment_id: string | null;
  tracking_number: string | null;
  carrier_status: string | null;
  packed_at: TimestampColumn | null;
  label_purchased_at: TimestampColumn | null;
  shipped_at: TimestampColumn | null;
  delivered_at: TimestampColumn | null;
  cancelled_at: TimestampColumn | null;
  cancel_reason: string | null;
  version: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type RefundsTable = {
  id: string;
  order_id: string;
  payment_id: string;
  idempotency_key: string;
  payment_refund_idempotency_key: string;
  restock_idempotency_key: string | null;
  status: string;
  amount: number;
  currency: string;
  reason: string;
  return_required: boolean;
  restock_sku: string | null;
  restock_quantity: number | null;
  approved_at: TimestampColumn | null;
  rejected_at: TimestampColumn | null;
  rejection_reason: string | null;
  payment_refunded_at: TimestampColumn | null;
  restocked_at: TimestampColumn | null;
  completed_at: TimestampColumn | null;
  version: number;
  created_at: TimestampColumn;
  updated_at: TimestampColumn;
};

export type SettlementsTable = {
  id: string;
  order_id: string;
  payment_id: string;
  status: string;
  gross_amount: number;
  refunded_amount: number;
  net_amount: number;
  currency: string;
  delivered_at: TimestampColumn | null;
  ready_at: TimestampColumn | null;
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
  domain_events: DomainEventsTable;
  fulfillments: FulfillmentsTable;
  inventory_items: InventoryItemsTable;
  inventory_restocks: InventoryRestocksTable;
  inventory_reservations: InventoryReservationsTable;
  orders: OrdersTable;
  outbox_events: OutboxEventsTable;
  payments: PaymentsTable;
  refunds: RefundsTable;
  settlements: SettlementsTable;
  kysely_migration: KyselyMigrationTable;
  kysely_migration_lock: KyselyMigrationLockTable;
};

export type OrderRow = Selectable<OrdersTable>;
export type OrderInsert = Insertable<OrdersTable>;
export type OrderUpdate = Updateable<OrdersTable>;
export type DomainEventRow = Selectable<DomainEventsTable>;
export type DomainEventInsert = Insertable<DomainEventsTable>;
export type OutboxEventRow = Selectable<OutboxEventsTable>;
export type OutboxEventInsert = Insertable<OutboxEventsTable>;
export type InventoryItemRow = Selectable<InventoryItemsTable>;
export type InventoryItemInsert = Insertable<InventoryItemsTable>;
export type InventoryItemUpdate = Updateable<InventoryItemsTable>;
export type InventoryReservationRow = Selectable<InventoryReservationsTable>;
export type InventoryReservationInsert = Insertable<InventoryReservationsTable>;
export type InventoryReservationUpdate = Updateable<InventoryReservationsTable>;
export type InventoryRestockRow = Selectable<InventoryRestocksTable>;
export type InventoryRestockInsert = Insertable<InventoryRestocksTable>;
export type PaymentRow = Selectable<PaymentsTable>;
export type PaymentInsert = Insertable<PaymentsTable>;
export type PaymentUpdate = Updateable<PaymentsTable>;
export type FulfillmentRow = Selectable<FulfillmentsTable>;
export type FulfillmentInsert = Insertable<FulfillmentsTable>;
export type FulfillmentUpdate = Updateable<FulfillmentsTable>;
export type RefundRow = Selectable<RefundsTable>;
export type RefundInsert = Insertable<RefundsTable>;
export type RefundUpdate = Updateable<RefundsTable>;
export type SettlementRow = Selectable<SettlementsTable>;
export type SettlementInsert = Insertable<SettlementsTable>;
export type SettlementUpdate = Updateable<SettlementsTable>;
