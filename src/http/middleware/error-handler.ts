import type { ErrorHandler } from "hono";
import type { Logger } from "pino";
import type { AppBindings } from "../context.js";

export function createErrorHandler(logger: Logger): ErrorHandler<AppBindings> {
  return (error, c) => {
    const requestId = c.get("requestId");
    logger.error({ error, requestId }, "unhandled http error");

    return c.json(
      {
        error: {
          type: "InternalServerError",
          message: "Unexpected server error",
          requestId,
        },
      },
      500,
    );
  };
}
