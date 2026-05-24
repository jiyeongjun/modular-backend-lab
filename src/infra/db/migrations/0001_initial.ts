import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("orders")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("total_amount", "integer", (col) => col.notNull())
    .addColumn("currency", "text", (col) => col.notNull())
    .addColumn("paid_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("outbox_events")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("event_type", "text", (col) => col.notNull())
    .addColumn("aggregate_type", "text", (col) => col.notNull())
    .addColumn("aggregate_id", "text", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("processed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("orders_status_idx").on("orders").column("status").execute();
  await db.schema
    .createIndex("outbox_events_unprocessed_idx")
    .on("outbox_events")
    .columns(["processed_at", "occurred_at", "id"])
    .execute();
  await db.schema
    .createIndex("outbox_events_aggregate_idx")
    .on("outbox_events")
    .columns(["aggregate_type", "aggregate_id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("outbox_events").ifExists().execute();
  await db.schema.dropTable("orders").ifExists().execute();
}
