import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("payments")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("order_id", "text", (col) => col.notNull().unique())
    .addColumn("provider", "text", (col) => col.notNull())
    .addColumn("provider_payment_key", "text", (col) => col.notNull().unique())
    .addColumn("confirm_idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("cancel_idempotency_key", "text", (col) => col.unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("amount", "integer", (col) => col.notNull())
    .addColumn("currency", "text", (col) => col.notNull())
    .addColumn("provider_status", "text")
    .addColumn("method", "text")
    .addColumn("receipt_url", "text")
    .addColumn("failure_code", "text")
    .addColumn("failure_message", "text")
    .addColumn("cancel_reason", "text")
    .addColumn("authorized_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("cancelled_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("payments_status_idx").on("payments").column("status").execute();
  await db.schema
    .createIndex("payments_order_status_idx")
    .on("payments")
    .columns(["order_id", "status"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("payments").ifExists().execute();
}
