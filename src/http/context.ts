import type { Logger } from "pino";

export type AppBindings = {
  Variables: {
    requestId: string;
    logger: Logger;
  };
};
