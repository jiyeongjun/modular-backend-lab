import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { Logger } from "pino";
import type { AppConfig } from "../config/env.js";

export type TelemetryHandle = Readonly<{
  shutdown(): Promise<void>;
}>;

export function initializeTelemetry(config: AppConfig, logger: Logger): TelemetryHandle {
  if (config.otel.tracesExporter === "none" && config.otel.metricsExporter === "none") {
    return { shutdown: async () => undefined };
  }

  const sdkOptions: ConstructorParameters<typeof NodeSDK>[0] = {
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.otel.serviceName,
    }),
  };

  if (config.otel.tracesExporter === "otlp") {
    sdkOptions.traceExporter = new OTLPTraceExporter({ url: `${config.otel.endpoint}/v1/traces` });
  }

  if (config.otel.metricsExporter === "otlp") {
    sdkOptions.metricReader = new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${config.otel.endpoint}/v1/metrics` }),
    });
  }

  const sdk = new NodeSDK(sdkOptions);

  sdk.start();
  logger.info({ serviceName: config.otel.serviceName }, "telemetry initialized");

  return {
    shutdown: () => sdk.shutdown(),
  };
}
