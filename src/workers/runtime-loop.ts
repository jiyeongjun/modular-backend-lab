import type { Logger } from "pino";

export type RuntimeLoopHandle = Readonly<{
  done: Promise<void>;
  stop(): Promise<void>;
}>;

export function startRuntimeLoop(options: {
  name: string;
  intervalMs: number;
  logger: Logger;
  run(): Promise<void>;
  shutdown?(): Promise<void>;
}): RuntimeLoopHandle {
  let stopping = false;
  let sleepTimer: NodeJS.Timeout | null = null;
  let resolveSleep: (() => void) | null = null;

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      resolveSleep = resolve;
      sleepTimer = setTimeout(() => {
        sleepTimer = null;
        resolveSleep = null;
        resolve();
      }, ms);
    });
  }

  const done = (async () => {
    try {
      while (!stopping) {
        try {
          await options.run();
        } catch (error) {
          options.logger.error({ error, runtime: options.name }, "runtime loop iteration failed");
        }

        if (!stopping) {
          await sleep(options.intervalMs);
        }
      }
    } finally {
      await options.shutdown?.();
      options.logger.info({ runtime: options.name }, "runtime loop stopped");
    }
  })();

  return {
    done,
    async stop() {
      stopping = true;

      if (sleepTimer !== null) {
        clearTimeout(sleepTimer);
        sleepTimer = null;
      }

      if (resolveSleep !== null) {
        const resolve = resolveSleep;
        resolveSleep = null;
        resolve();
      }

      await done;
    },
  };
}
