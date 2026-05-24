import { performance } from "node:perf_hooks";
import type { MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import type { AppBindings } from "../context.js";

export function requestLoggerMiddleware(logger: Logger): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const startedAt = performance.now();
    const requestId = c.get("requestId");
    const requestLogger = logger.child({ requestId });
    c.set("logger", requestLogger);

    await next();

    requestLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        statusCode: c.res.status,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      },
      "http request",
    );
  };
}
