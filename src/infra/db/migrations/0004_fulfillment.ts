import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("fulfillments")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("order_id", "text", (col) => col.notNull().unique())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("recipient_name", "text", (col) => col.notNull())
    .addColumn("recipient_phone", "text", (col) => col.notNull())
    .addColumn("address_line1", "text", (col) => col.notNull())
    .addColumn("address_line2", "text")
    .addColumn("postal_code", "text", (col) => col.notNull())
    .addColumn("country", "text", (col) => col.notNull())
    .addColumn("weight_grams", "integer", (col) => col.notNull())
    .addColumn("package_description", "text")
    .addColumn("label_idempotency_key", "text", (col) => col.unique())
    .addColumn("carrier", "text")
    .addColumn("carrier_shipment_id", "text", (col) => col.unique())
    .addColumn("tracking_number", "text", (col) => col.unique())
    .addColumn("carrier_status", "text")
    .addColumn("packed_at", "timestamptz")
    .addColumn("label_purchased_at", "timestamptz")
    .addColumn("shipped_at", "timestamptz")
    .addColumn("delivered_at", "timestamptz")
    .addColumn("cancelled_at", "timestamptz")
    .addColumn("cancel_reason", "text")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("fulfillments_status_idx")
    .on("fulfillments")
    .column("status")
    .execute();
  await db.schema
    .createIndex("fulfillments_trackable_idx")
    .on("fulfillments")
    .columns(["status", "updated_at", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("fulfillments").ifExists().execute();
}
