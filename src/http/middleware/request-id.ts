import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../context.js";

export function requestIdMiddleware(): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const requestId = c.req.header("x-request-id") ?? randomUUID();
    c.set("requestId", requestId);
    c.header("x-request-id", requestId);
    await next();
  };
}
