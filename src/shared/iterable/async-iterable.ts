export async function* mapAsync<T, U>(
  source: AsyncIterable<T>,
  mapper: (value: T, index: number) => U | Promise<U>,
): AsyncIterable<U> {
  let index = 0;

  for await (const item of source) {
    yield mapper(item, index);
    index += 1;
  }
}

export async function* filterAsync<T>(
  source: AsyncIterable<T>,
  predicate: (value: T, index: number) => boolean | Promise<boolean>,
): AsyncIterable<T> {
  let index = 0;

  for await (const item of source) {
    if (await predicate(item, index)) {
      yield item;
    }
    index += 1;
  }
}

export async function* takeAsync<T>(source: AsyncIterable<T>, limit: number): AsyncIterable<T> {
  if (limit < 0) {
    throw new Error("takeAsync limit must be non-negative");
  }

  let count = 0;
  for await (const item of source) {
    if (count >= limit) {
      return;
    }
    yield item;
    count += 1;
  }
}

export async function* chunkAsync<T>(
  source: AsyncIterable<T>,
  size: number,
): AsyncIterable<readonly T[]> {
  if (size < 1) {
    throw new Error("chunkAsync size must be greater than zero");
  }

  let chunk: T[] = [];

  for await (const item of source) {
    chunk.push(item);
    if (chunk.length >= size) {
      yield chunk;
      chunk = [];
    }
  }

  if (chunk.length > 0) {
    yield chunk;
  }
}

export async function* tapAsync<T>(
  source: AsyncIterable<T>,
  effect: (value: T, index: number) => void | Promise<void>,
): AsyncIterable<T> {
  let index = 0;

  for await (const item of source) {
    await effect(item, index);
    yield item;
    index += 1;
  }
}

export async function collectAsync<T>(source: AsyncIterable<T>): Promise<T[]> {
  const items: T[] = [];

  for await (const item of source) {
    items.push(item);
  }

  return items;
}
