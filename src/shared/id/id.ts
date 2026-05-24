import { randomUUID } from "node:crypto";

export type IdGenerator = {
  generate(): string;
};

export const uuidGenerator: IdGenerator = {
  generate: () => randomUUID(),
};
