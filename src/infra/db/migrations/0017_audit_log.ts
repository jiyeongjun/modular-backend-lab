import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("audit_log_records")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("resource_type", "text", (col) => col.notNull())
    .addColumn("resource_id", "text")
    .addColumn("result", "text", (col) => col.notNull())
    .addColumn("reason", "text")
    .addColumn("request_id", "text")
    .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("occurred_at", "timestamptz", (col) => col.notNull())
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("audit_log_records_actor_occurred_idx")
    .on("audit_log_records")
    .columns(["actor_id", "occurred_at"])
    .execute();

  await db.schema
    .createIndex("audit_log_records_resource_idx")
    .on("audit_log_records")
    .columns(["resource_type", "resource_id", "occurred_at"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("audit_log_records").ifExists().execute();
}
