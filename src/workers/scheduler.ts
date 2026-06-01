export type ScheduledJob = Readonly<{
  name: string;
  intervalMs: number;
  run(): Promise<void>;
}>;

export type SchedulerHandle = Readonly<{
  stop(): Promise<void>;
}>;

export function startIntervalScheduler(
  jobs: readonly ScheduledJob[],
  options: { runImmediately?: boolean } = {},
): SchedulerHandle {
  let stopped = false;
  const running = new Map<string, Promise<void>>();

  function runJob(job: ScheduledJob): void {
    if (stopped || running.has(job.name)) {
      return;
    }

    const run = job
      .run()
      .catch(() => undefined)
      .finally(() => {
        running.delete(job.name);
      });
    running.set(job.name, run);
  }

  const timers = jobs.map((job) => setInterval(() => runJob(job), job.intervalMs));

  if (options.runImmediately === true) {
    for (const job of jobs) {
      runJob(job);
    }
  }

  return {
    async stop() {
      stopped = true;

      for (const timer of timers) {
        clearInterval(timer);
      }

      await Promise.allSettled(running.values());
    },
  };
}
