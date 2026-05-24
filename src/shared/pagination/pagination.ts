export type PageRequest = Readonly<{
  limit: number;
  cursor?: string;
}>;

export type Page<T> = Readonly<{
  items: readonly T[];
  nextCursor?: string;
}>;

export function normalizeLimit(value: number, options: { min: number; max: number }): number {
  if (!Number.isInteger(value)) {
    return options.min;
  }

  return Math.min(Math.max(value, options.min), options.max);
}
