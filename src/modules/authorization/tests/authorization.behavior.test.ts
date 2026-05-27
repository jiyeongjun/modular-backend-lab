import { describe, expect, it } from "vitest";
import {
  authorizationRoleGrantedEvent,
  evaluateAuthorization,
  grantAuthorizationRole,
  revokeAuthorizationRole,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createGrantFixture() {
  const granted = grantAuthorizationRole({
    id: "grant-1",
    actorId: "actor-1",
    role: "SUPPORT_AGENT",
    idempotencyKey: "grant-role-1",
    grantedByActorId: "admin-1",
    grantReason: "support team member",
    now,
  });
  if (!granted.ok) {
    throw new Error("expected role grant to be created");
  }
  return granted.value;
}

describe("authorization domain behavior", () => {
  it("grants a role with an event", () => {
    const grant = createGrantFixture();
    const event = authorizationRoleGrantedEvent(grant);

    expect(grant.status).toBe("ACTIVE");
    expect(event.type).toBe("AuthorizationRoleGranted");
    expect(event.payload.role).toBe("SUPPORT_AGENT");
  });

  it("allows permissions that are included in an active role", () => {
    const grant = createGrantFixture();

    const decision = evaluateAuthorization([grant], {
      actorId: "actor-1",
      permission: "support-ticket:assign",
      resource: { type: "SUPPORT_TICKET", id: "ticket-1" },
    });

    expect(decision.allowed).toBe(true);
    expect(decision.matchedRole).toBe("SUPPORT_AGENT");
  });

  it("denies permissions that no active role allows", () => {
    const grant = createGrantFixture();

    const decision = evaluateAuthorization([grant], {
      actorId: "actor-1",
      permission: "settlement:sync",
      resource: { type: "SETTLEMENT", id: "order-1" },
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("NoActiveRoleAllowsPermission");
  });

  it("revokes a role grant and makes repeated revoke idempotent", () => {
    const grant = createGrantFixture();

    const revoked = revokeAuthorizationRole(grant, {
      revokedByActorId: "admin-1",
      revokeReason: "team changed",
      now: later,
    });
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) {
      throw new Error("expected role grant to be revoked");
    }

    const repeated = revokeAuthorizationRole(revoked.value.grant, {
      revokedByActorId: "admin-1",
      revokeReason: "team changed",
      now: later,
    });

    expect(repeated.ok).toBe(true);
    if (!repeated.ok) {
      throw new Error("expected repeated revoke to be idempotent");
    }
    expect(revoked.value.grant.status).toBe("REVOKED");
    expect(revoked.value.events.map((event) => event.type)).toEqual(["AuthorizationRoleRevoked"]);
    expect(repeated.value.events).toHaveLength(0);
  });
});
