import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenService } from "../ports/index.js";

export function createLocalAuthTokenService(): AuthTokenService {
  return {
    async issue() {
      const token = randomBytes(32).toString("base64url");
      return {
        token,
        tokenHash: hashToken(token),
      };
    },

    async hash(token) {
      return hashToken(token);
    },
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
