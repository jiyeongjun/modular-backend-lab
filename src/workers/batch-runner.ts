export type BatchJob = Readonly<{
  name: string;
  run(): Promise<void>;
}>;

export async function runBatchJob(job: BatchJob): Promise<void> {
  await job.run();
}
