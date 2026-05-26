import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("return_requests")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("order_id", "text", (col) => col.notNull())
    .addColumn("fulfillment_id", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("rma_number", "text", (col) => col.unique())
    .addColumn("reason", "text", (col) => col.notNull())
    .addColumn("items", "jsonb", (col) => col.notNull())
    .addColumn("restockable_items", "jsonb")
    .addColumn("inspection_note", "text")
    .addColumn("rejection_reason", "text")
    .addColumn("requested_at", "timestamptz", (col) => col.notNull())
    .addColumn("authorized_at", "timestamptz")
    .addColumn("received_at", "timestamptz")
    .addColumn("inspected_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("return_requests_order_status_idx")
    .on("return_requests")
    .columns(["order_id", "status", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("return_requests").ifExists().execute();
}
