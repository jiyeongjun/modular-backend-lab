import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("address_book_addresses")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("customer_id", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("purpose", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("label", "text")
    .addColumn("recipient_name", "text", (col) => col.notNull())
    .addColumn("phone", "text", (col) => col.notNull())
    .addColumn("line1", "text", (col) => col.notNull())
    .addColumn("line2", "text")
    .addColumn("city", "text", (col) => col.notNull())
    .addColumn("region", "text")
    .addColumn("postal_code", "text", (col) => col.notNull())
    .addColumn("country", "text", (col) => col.notNull())
    .addColumn("is_default", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("disabled_at", "timestamptz")
    .addColumn("disable_reason", "text")
    .addColumn("added_at", "timestamptz", (col) => col.notNull())
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("address_book_addresses_customer_status_idx")
    .on("address_book_addresses")
    .columns(["customer_id", "status", "purpose", "id"])
    .execute();

  await sql`
    create unique index address_book_addresses_default_idx
    on address_book_addresses (customer_id, purpose)
    where is_default = true and status = 'ACTIVE'
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("address_book_addresses").ifExists().execute();
}
