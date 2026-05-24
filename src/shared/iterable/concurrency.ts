export type ParallelMapOptions = Readonly<{
  concurrency: number;
}>;

export async function* parallelMapAsync<T, U>(
  source: AsyncIterable<T>,
  mapper: (value: T, index: number) => Promise<U>,
  options: ParallelMapOptions,
): AsyncIterable<U> {
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("parallelMapAsync requires concurrency >= 1");
  }

  const iterator = source[Symbol.asyncIterator]();
  const executing = new Set<Promise<U>>();
  let index = 0;
  let sourceDone = false;

  async function enqueue(): Promise<void> {
    const next = await iterator.next();
    if (next.done === true) {
      sourceDone = true;
      return;
    }

    const currentIndex = index;
    index += 1;
    const task = mapper(next.value, currentIndex);
    executing.add(task);
    task.then(
      () => executing.delete(task),
      () => executing.delete(task),
    );
  }

  while (!sourceDone && executing.size < options.concurrency) {
    await enqueue();
  }

  while (executing.size > 0) {
    const value = await Promise.race(executing);
    yield value;

    while (!sourceDone && executing.size < options.concurrency) {
      await enqueue();
    }
  }
}
