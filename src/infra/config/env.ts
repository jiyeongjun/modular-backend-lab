import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  VALKEY_URL: z.string().url(),
  QUEUE_BACKEND: z.enum(["bullmq", "sqs", "memory"]).default("bullmq"),
  BULLMQ_QUEUE_PREFIX: z.string().min(1).default("modular-backend-lab"),
  OTEL_SERVICE_NAME: z.string().min(1).default("modular-backend-lab"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://localhost:4318"),
  OTEL_TRACES_EXPORTER: z.enum(["otlp", "none"]).default("otlp"),
  OTEL_METRICS_EXPORTER: z.enum(["otlp", "none"]).default("otlp"),
  OUTBOX_WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  SCHEDULER_INVENTORY_RESERVATION_EXPIRER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60_000),
  SCHEDULER_FULFILLMENT_STATUS_SYNCER_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(300_000),
  SCHEDULER_SETTLEMENT_SYNCER_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  TOSS_PAYMENTS_SECRET_KEY: z.string().min(1).optional(),
  TOSS_PAYMENTS_BASE_URL: z.string().url().default("https://api.tosspayments.com"),
});

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  valkeyUrl: string;
  queueBackend: "bullmq" | "sqs" | "memory";
  bullmqQueuePrefix: string;
  otel: {
    serviceName: string;
    endpoint: string;
    tracesExporter: "otlp" | "none";
    metricsExporter: "otlp" | "none";
  };
  worker: {
    outboxPollIntervalMs: number;
  };
  scheduler: {
    inventoryReservationExpirerIntervalMs: number;
    fulfillmentStatusSyncerIntervalMs: number;
    settlementSyncerIntervalMs: number;
  };
  tossPayments: {
    secretKey: string | null;
    baseUrl: string;
  };
}>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(source);

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    logLevel: parsed.LOG_LEVEL,
    valkeyUrl: parsed.VALKEY_URL,
    queueBackend: parsed.QUEUE_BACKEND,
    bullmqQueuePrefix: parsed.BULLMQ_QUEUE_PREFIX,
    otel: {
      serviceName: parsed.OTEL_SERVICE_NAME,
      endpoint: parsed.OTEL_EXPORTER_OTLP_ENDPOINT,
      tracesExporter: parsed.OTEL_TRACES_EXPORTER,
      metricsExporter: parsed.OTEL_METRICS_EXPORTER,
    },
    worker: {
      outboxPollIntervalMs: parsed.OUTBOX_WORKER_POLL_INTERVAL_MS,
    },
    scheduler: {
      inventoryReservationExpirerIntervalMs:
        parsed.SCHEDULER_INVENTORY_RESERVATION_EXPIRER_INTERVAL_MS,
      fulfillmentStatusSyncerIntervalMs: parsed.SCHEDULER_FULFILLMENT_STATUS_SYNCER_INTERVAL_MS,
      settlementSyncerIntervalMs: parsed.SCHEDULER_SETTLEMENT_SYNCER_INTERVAL_MS,
    },
    tossPayments: {
      secretKey: parsed.TOSS_PAYMENTS_SECRET_KEY ?? null,
      baseUrl: parsed.TOSS_PAYMENTS_BASE_URL,
    },
  };
}
