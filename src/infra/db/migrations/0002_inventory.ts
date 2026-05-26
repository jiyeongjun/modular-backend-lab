import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("inventory_items")
    .addColumn("sku", "text", (col) => col.primaryKey())
    .addColumn("on_hand", "integer", (col) => col.notNull())
    .addColumn("reserved", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("inventory_reservations")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("sku", "text", (col) =>
      col.notNull().references("inventory_items.sku").onDelete("restrict"),
    )
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("quantity", "integer", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("released_at", "timestamptz")
    .addColumn("committed_at", "timestamptz")
    .addColumn("expired_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("inventory_reservations_sku_idx")
    .on("inventory_reservations")
    .column("sku")
    .execute();

  await db.schema
    .createIndex("inventory_reservations_expired_active_idx")
    .on("inventory_reservations")
    .columns(["status", "expires_at", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("inventory_reservations").ifExists().execute();
  await db.schema.dropTable("inventory_items").ifExists().execute();
}
