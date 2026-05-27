import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("support_tickets")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("customer_id", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("category", "text", (col) => col.notNull())
    .addColumn("priority", "text", (col) => col.notNull())
    .addColumn("subject", "text", (col) => col.notNull())
    .addColumn("description", "text", (col) => col.notNull())
    .addColumn("order_id", "text")
    .addColumn("return_id", "text")
    .addColumn("refund_id", "text")
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("assignee_id", "text")
    .addColumn("resolution", "text")
    .addColumn("opened_at", "timestamptz", (col) => col.notNull())
    .addColumn("assigned_at", "timestamptz")
    .addColumn("waiting_at", "timestamptz")
    .addColumn("resolved_at", "timestamptz")
    .addColumn("closed_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("support_tickets_customer_status_idx")
    .on("support_tickets")
    .columns(["customer_id", "status", "id"])
    .execute();

  await db.schema
    .createIndex("support_tickets_order_idx")
    .on("support_tickets")
    .column("order_id")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("support_tickets").ifExists().execute();
}
