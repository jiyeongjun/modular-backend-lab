export type ScheduledJob = Readonly<{
  name: string;
  intervalMs: number;
  run(): Promise<void>;
}>;

export type SchedulerHandle = Readonly<{
  stop(): void;
}>;

export function startIntervalScheduler(jobs: readonly ScheduledJob[]): SchedulerHandle {
  const timers = jobs.map((job) =>
    setInterval(() => {
      void job.run();
    }, job.intervalMs),
  );

  return {
    stop() {
      for (const timer of timers) {
        clearInterval(timer);
      }
    },
  };
}
