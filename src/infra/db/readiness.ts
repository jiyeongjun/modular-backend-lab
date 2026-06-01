import { sql } from "kysely";
import type { Db } from "./db.js";

export async function checkDatabaseReadiness(db: Db): Promise<boolean> {
  try {
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}
