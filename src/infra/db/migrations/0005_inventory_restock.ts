import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("inventory_restocks")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("sku", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("quantity", "integer", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("inventory_restocks_sku_idx")
    .on("inventory_restocks")
    .column("sku")
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("inventory_restocks").ifExists().execute();
}
