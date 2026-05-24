import pino, { type Logger } from "pino";
import type { AppConfig } from "../config/env.js";

export function createLogger(config: Pick<AppConfig, "logLevel" | "nodeEnv">): Logger {
  return pino({
    enabled: config.logLevel !== "silent",
    level: config.logLevel,
    messageKey: "message",
    base: {
      service: "modular-backend-lab",
      environment: config.nodeEnv,
    },
  });
}
