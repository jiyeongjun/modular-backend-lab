import { trace } from "@opentelemetry/api";

export function getActiveTraceId(): string | undefined {
  const spanContext = trace.getActiveSpan()?.spanContext();
  return spanContext?.traceId;
}
