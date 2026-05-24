import { type Context, context, propagation } from "@opentelemetry/api";

export function extractTraceContext(headers: Record<string, string | undefined>): Context {
  return propagation.extract(context.active(), headers);
}
