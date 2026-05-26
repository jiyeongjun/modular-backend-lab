import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("refunds")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("order_id", "text", (col) => col.notNull().unique())
    .addColumn("payment_id", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("payment_refund_idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("restock_idempotency_key", "text", (col) => col.unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("amount", "integer", (col) => col.notNull())
    .addColumn("currency", "text", (col) => col.notNull())
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("return_required", "boolean", (col) => col.notNull())
    .addColumn("restock_sku", "text")
    .addColumn("restock_quantity", "integer")
    .addColumn("approved_at", "timestamptz")
    .addColumn("rejected_at", "timestamptz")
    .addColumn("rejection_reason", "text")
    .addColumn("payment_refunded_at", "timestamptz")
    .addColumn("restocked_at", "timestamptz")
    .addColumn("completed_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("refunds_status_idx").on("refunds").column("status").execute();
  await db.schema
    .createIndex("refunds_payment_id_idx")
    .on("refunds")
    .column("payment_id")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("refunds").ifExists().execute();
}
