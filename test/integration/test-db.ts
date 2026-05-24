import { execFileSync } from "node:child_process";
import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { closeDatabase, createDatabase, type Db } from "../../src/infra/db/db.js";
import { migrateToLatest } from "../../src/infra/db/migrator.js";
import { startPostgresTestContainer } from "./postgres-test-container.js";

export function isDockerAvailable(): boolean {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function withTestDatabase(work: (db: Db) => Promise<void>): Promise<void> {
  let container: StartedPostgreSqlContainer | undefined;
  let db: Db | undefined;

  try {
    container = await startPostgresTestContainer();
    db = createDatabase({ databaseUrl: container.getConnectionUri() });
    const migrations = await migrateToLatest(db);
    if (migrations.error) {
      throw migrations.error;
    }

    await work(db);
  } finally {
    if (db) {
      await closeDatabase(db);
    }
    if (container) {
      await container.stop();
    }
  }
}
