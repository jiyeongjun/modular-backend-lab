import { describe, expect, it, vi } from "vitest";
import { startIntervalScheduler } from "./scheduler.js";

describe("startIntervalScheduler", () => {
  it("does not overlap a job and waits for in-flight work on stop", async () => {
    vi.useFakeTimers();

    try {
      const releaseRuns: Array<() => void> = [];
      let runCount = 0;
      const handle = startIntervalScheduler(
        [
          {
            name: "slow-job",
            intervalMs: 10,
            run: async () => {
              runCount += 1;
              await new Promise<void>((resolve) => {
                releaseRuns.push(resolve);
              });
            },
          },
        ],
        { runImmediately: true },
      );

      await vi.advanceTimersByTimeAsync(30);

      expect(runCount).toBe(1);

      const stopped = handle.stop();
      let stoppedDone = false;
      void stopped.then(() => {
        stoppedDone = true;
      });

      await Promise.resolve();
      expect(stoppedDone).toBe(false);

      const releaseRun = releaseRuns[0];
      if (releaseRun === undefined) {
        throw new Error("expected scheduler run to start");
      }

      releaseRun();
      await stopped;

      expect(stoppedDone).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
