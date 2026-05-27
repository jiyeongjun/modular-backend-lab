import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("customers")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("suspension_reason", "text")
    .addColumn("closure_reason", "text")
    .addColumn("registered_at", "timestamptz", (col) => col.notNull())
    .addColumn("suspended_at", "timestamptz")
    .addColumn("closed_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("customers_status_idx")
    .on("customers")
    .columns(["status", "registered_at", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("customers").ifExists().execute();
}
