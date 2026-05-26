import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("domain_events")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("aggregate_type", "text", (col) => col.notNull())
    .addColumn("aggregate_id", "text", (col) => col.notNull())
    .addColumn("aggregate_version", "integer", (col) => col.notNull())
    .addColumn("event_type", "text", (col) => col.notNull())
    .addColumn("event_schema_version", "integer", (col) => col.notNull().defaultTo(1))
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("domain_events_stream_version_idx")
    .on("domain_events")
    .columns(["aggregate_type", "aggregate_id", "aggregate_version"])
    .unique()
    .execute();

  await db.schema
    .createIndex("domain_events_type_time_idx")
    .on("domain_events")
    .columns(["event_type", "occurred_at", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("domain_events").ifExists().execute();
}
