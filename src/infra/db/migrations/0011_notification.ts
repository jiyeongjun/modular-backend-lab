import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("notification_requests")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("channel", "text", (col) => col.notNull())
    .addColumn("recipient", "text", (col) => col.notNull())
    .addColumn("template_key", "text", (col) => col.notNull())
    .addColumn("payload", "jsonb", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("provider_message_id", "text")
    .addColumn("last_failure_code", "text")
    .addColumn("last_failure_message", "text")
    .addColumn("attempt_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("requested_at", "timestamptz", (col) => col.notNull())
    .addColumn("sent_at", "timestamptz")
    .addColumn("failed_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("notification_requests_status_idx")
    .on("notification_requests")
    .columns(["status", "requested_at", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("notification_requests").ifExists().execute();
}
