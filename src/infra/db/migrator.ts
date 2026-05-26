import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Migration, type MigrationResultSet, Migrator } from "kysely/migration";
import { loadConfig } from "../config/env.js";
import { closeDatabase, createDatabase, type Db } from "./db.js";
import * as initialMigration from "./migrations/0001_initial.js";
import * as inventoryMigration from "./migrations/0002_inventory.js";
import * as paymentMigration from "./migrations/0003_payment.js";

const migrations: Record<string, Migration> = {
  "0001_initial": initialMigration,
  "0002_inventory": inventoryMigration,
  "0003_payment": paymentMigration,
};

export function createMigrator(db: Db): Migrator {
  return new Migrator({
    db,
    provider: {
      getMigrations: async () => migrations,
    },
  });
}

export async function migrateToLatest(db: Db): Promise<MigrationResultSet> {
  return createMigrator(db).migrateToLatest();
}

export async function rollbackLatest(db: Db): Promise<MigrationResultSet> {
  return createMigrator(db).migrateDown();
}

function summarize(resultSet: MigrationResultSet): void {
  for (const result of resultSet.results ?? []) {
    console.log(`${result.migrationName}: ${result.status}`);
  }

  if (resultSet.error) {
    console.error(resultSet.error);
  }
}

async function runCli(): Promise<void> {
  const direction = process.argv[2] ?? "up";
  const config = loadConfig();
  const db = createDatabase(config);

  try {
    const result = direction === "down" ? await rollbackLatest(db) : await migrateToLatest(db);
    summarize(result);

    if (result.error) {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabase(db);
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (fileURLToPath(import.meta.url) === executedPath) {
  runCli().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
