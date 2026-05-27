import { type Kysely, sql } from "kysely";
import type { Database } from "../database.js";

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable("auth_email_credentials")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("customer_id", "text", (col) => col.notNull())
    .addColumn("idempotency_key", "text", (col) => col.notNull().unique())
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("password_hash", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("failed_login_count", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("registered_at", "timestamptz", (col) => col.notNull())
    .addColumn("password_updated_at", "timestamptz", (col) => col.notNull())
    .addColumn("last_login_at", "timestamptz")
    .addColumn("locked_at", "timestamptz")
    .addColumn("disabled_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("auth_email_credentials_customer_status_idx")
    .on("auth_email_credentials")
    .columns(["customer_id", "status", "id"])
    .execute();

  await db.schema
    .createTable("auth_sessions")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("customer_id", "text", (col) => col.notNull())
    .addColumn("credential_id", "text", (col) => col.notNull())
    .addColumn("token_hash", "text", (col) => col.notNull().unique())
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("issued_at", "timestamptz", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("expired_at", "timestamptz")
    .addColumn("version", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("auth_sessions_customer_status_idx")
    .on("auth_sessions")
    .columns(["customer_id", "status", "expires_at", "id"])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("auth_sessions").ifExists().execute();
  await db.schema.dropTable("auth_email_credentials").ifExists().execute();
}
