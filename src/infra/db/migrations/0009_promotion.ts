import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("coupons")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("code", "text", (col) => col.notNull().unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("discount_type", "text", (col) => col.notNull())
    .addColumn("discount_amount", "integer")
    .addColumn("discount_basis_points", "integer")
    .addColumn("max_discount_amount", "integer")
    .addColumn("currency", "text", (col) => col.notNull())
    .addColumn("min_order_amount", "integer", (col) => col.notNull())
    .addColumn("eligible_skus", "jsonb")
    .addColumn("max_redemptions", "integer", (col) => col.notNull())
    .addColumn("redeemed_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("starts_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("disabled_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("coupons_status_expires_idx")
    .on("coupons")
    .columns(["status", "expires_at", "id"])
    .execute();

  await db.schema
    .createTable("coupon_redemptions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("coupon_id", "text", (col) => col.notNull().references("coupons.id"))
    .addColumn("coupon_code", "text", (col) => col.notNull())
    .addColumn("order_id", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("order_amount", "integer", (col) => col.notNull())
    .addColumn("discount_amount", "integer", (col) => col.notNull())
    .addColumn("currency", "text", (col) => col.notNull())
    .addColumn("reserved_at", "timestamptz", (col) => col.notNull())
    .addColumn("committed_at", "timestamptz")
    .addColumn("released_at", "timestamptz")
    .addColumn("release_reason", "text")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("coupon_redemptions_order_coupon_idx")
    .on("coupon_redemptions")
    .columns(["order_id", "coupon_code", "status"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("coupon_redemptions").ifExists().execute();
  await db.schema.dropTable("coupons").ifExists().execute();
}
