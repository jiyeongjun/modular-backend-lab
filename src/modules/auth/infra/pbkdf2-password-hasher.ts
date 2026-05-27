import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PasswordHasher } from "../ports/index.js";

const pbkdf2Async = promisify(pbkdf2);
const ALGORITHM = "pbkdf2_sha512";
const ITERATIONS = 210_000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";

export function createPbkdf2PasswordHasher(): PasswordHasher {
  return {
    async hash(plainPassword) {
      const salt = randomBytes(16).toString("hex");
      const derivedKey = await pbkdf2Async(plainPassword, salt, ITERATIONS, KEY_LENGTH, DIGEST);
      return `${ALGORITHM}$${ITERATIONS}$${salt}$${derivedKey.toString("hex")}`;
    },

    async verify(plainPassword, passwordHash) {
      const parsed = parsePasswordHash(passwordHash);
      if (parsed === null) {
        return false;
      }

      const derivedKey = await pbkdf2Async(
        plainPassword,
        parsed.salt,
        parsed.iterations,
        KEY_LENGTH,
        DIGEST,
      );
      const expected = Buffer.from(parsed.hash, "hex");
      if (expected.length !== derivedKey.length) {
        return false;
      }

      return timingSafeEqual(expected, derivedKey);
    },
  };
}

function parsePasswordHash(
  passwordHash: string,
): Readonly<{ iterations: number; salt: string; hash: string }> | null {
  const parts = passwordHash.split("$");
  const algorithm = parts[0];
  const iterationsText = parts[1];
  const salt = parts[2];
  const hash = parts[3];
  if (
    parts.length !== 4 ||
    algorithm !== ALGORITHM ||
    iterationsText === undefined ||
    salt === undefined ||
    hash === undefined
  ) {
    return null;
  }

  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations <= 0) {
    return null;
  }

  return { iterations, salt, hash };
}
