export type CursorPage<T> = Readonly<{
  items: readonly T[];
  nextCursor: string | null;
}>;

export async function* iterateCursorPages<T>(
  loadPage: (cursor: string | null) => Promise<CursorPage<T>>,
): AsyncIterable<T> {
  let cursor: string | null = null;

  do {
    const page = await loadPage(cursor);
    for (const item of page.items) {
      yield item;
    }
    cursor = page.nextCursor;
  } while (cursor !== null);
}
