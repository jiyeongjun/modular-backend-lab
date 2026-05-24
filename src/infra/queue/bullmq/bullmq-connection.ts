import { Redis } from "ioredis";
import type { AppConfig } from "../../config/env.js";

export function createBullMqConnection(config: Pick<AppConfig, "valkeyUrl">): Redis {
  return new Redis(config.valkeyUrl, {
    maxRetriesPerRequest: null,
  });
}
