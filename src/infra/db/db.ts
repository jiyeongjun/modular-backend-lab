import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import type { AppConfig } from "../config/env.js";
import type { Database } from "./database.js";

export type Db = Kysely<Database>;

export function createDatabase(config: Pick<AppConfig, "databaseUrl">): Db {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: config.databaseUrl,
        max: 10,
      }),
    }),
  });
}

export async function closeDatabase(db: Db): Promise<void> {
  await db.destroy();
}
