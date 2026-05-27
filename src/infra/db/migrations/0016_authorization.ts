import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("authorization_role_grants")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("actor_id", "text", (col) => col.notNull())
    .addColumn("role", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("granted_by_actor_id", "text", (col) => col.notNull())
    .addColumn("grant_reason", "text")
    .addColumn("revoked_by_actor_id", "text")
    .addColumn("revoke_reason", "text")
    .addColumn("granted_at", "timestamptz", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("authorization_role_grants_actor_status_idx")
    .on("authorization_role_grants")
    .columns(["actor_id", "status", "role"])
    .execute();

  await sql`
    create unique index authorization_role_grants_active_role_idx
    on authorization_role_grants (actor_id, role)
    where status = 'ACTIVE'
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("authorization_role_grants").ifExists().execute();
}
