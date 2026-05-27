import { describe, expect, it } from "vitest";
import { createLocalAuthTokenService, createPbkdf2PasswordHasher } from "../infra/index.js";

describe("auth crypto adapters", () => {
  it("hashes and verifies passwords without exposing the plain password", async () => {
    const hasher = createPbkdf2PasswordHasher();

    const hash = await hasher.hash("password-1");

    expect(hash).not.toContain("password-1");
    expect(await hasher.verify("password-1", hash)).toBe(true);
    expect(await hasher.verify("wrong-password", hash)).toBe(false);
  });

  it("issues opaque tokens and stable token hashes", async () => {
    const service = createLocalAuthTokenService();

    const issued = await service.issue({
      sessionId: "session-1",
      customerId: "customer-1",
      credentialId: "credential-1",
      issuedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    expect(issued.token).not.toBe(issued.tokenHash);
    expect(await service.hash(issued.token)).toBe(issued.tokenHash);
  });
});
