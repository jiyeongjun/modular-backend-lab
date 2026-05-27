import { describe, expect, it } from "vitest";
import {
  createCheckAuthorizationUseCase,
  createGrantAuthorizationRoleUseCase,
  createRevokeAuthorizationRoleUseCase,
} from "../application/index.js";
import type { AuthorizationEvent, AuthorizationRole, RoleGrant } from "../domain/index.js";
import type {
  AuthorizationOutboxRepository,
  AuthorizationRepository,
  AuthorizationUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createFakeUow(): {
  uow: AuthorizationUnitOfWork;
  grants: RoleGrant[];
  outboxEvents: AuthorizationEvent[];
} {
  const grantState: RoleGrant[] = [];
  const outboxEvents: AuthorizationEvent[] = [];

  function findBy(predicate: (grant: RoleGrant) => boolean): RoleGrant | null {
    return grantState.find(predicate) ?? null;
  }

  const grants: AuthorizationRepository = {
    findById: async (id) => findBy((grant) => grant.id === id),
    findByIdForUpdate: async (id) => findBy((grant) => grant.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((grant) => grant.idempotencyKey === idempotencyKey),
    findActiveByActorId: async (actorId) =>
      grantState.filter((grant) => grant.actorId === actorId && grant.status === "ACTIVE"),
    findActiveByActorAndRole: async (actorId, role: AuthorizationRole) =>
      findBy(
        (grant) => grant.actorId === actorId && grant.role === role && grant.status === "ACTIVE",
      ),
    create: async (grant) => {
      grantState.push(grant);
    },
    save: async (grant) => {
      const index = grantState.findIndex((current) => current.id === grant.id);
      if (index === -1) {
        throw new Error("authorization role grant missing");
      }
      grantState[index] = grant;
    },
  };

  const outbox: AuthorizationOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ grants, outbox });
      },
    },
    grants: grantState,
    outboxEvents,
  };
}

function grantCommand() {
  return {
    actorId: "actor-1",
    role: "SUPPORT_AGENT" as const,
    idempotencyKey: "grant-role-1",
    grantedByActorId: "admin-1",
    grantReason: "support team member",
  };
}

describe("authorization usecases", () => {
  it("grants roles idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const grantRole = createGrantAuthorizationRoleUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "grant-1",
    });

    const first = await grantRole(grantCommand());
    const second = await grantRole(grantCommand());

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected authorization role grant to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.grants).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["AuthorizationRoleGranted"]);
  });

  it("checks permissions from active grants", async () => {
    const fake = createFakeUow();
    const grantRole = createGrantAuthorizationRoleUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "grant-1",
    });
    const check = createCheckAuthorizationUseCase({ uow: fake.uow });

    await grantRole(grantCommand());
    const allowed = await check({
      actorId: "actor-1",
      permission: "support-ticket:assign",
      resource: { type: "SUPPORT_TICKET", id: "ticket-1" },
    });
    const denied = await check({
      actorId: "actor-1",
      permission: "settlement:sync",
      resource: { type: "SETTLEMENT", id: "order-1" },
    });

    expect(allowed.ok).toBe(true);
    expect(denied.ok).toBe(true);
    if (!allowed.ok || !denied.ok) {
      throw new Error("expected authorization checks to complete");
    }
    expect(allowed.value.decision.allowed).toBe(true);
    expect(denied.value.decision.allowed).toBe(false);
  });

  it("revokes active role grants", async () => {
    const fake = createFakeUow();
    const grantRole = createGrantAuthorizationRoleUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "grant-1",
    });
    const revokeRole = createRevokeAuthorizationRoleUseCase({
      uow: fake.uow,
      now: () => later,
    });

    await grantRole(grantCommand());
    const result = await revokeRole({
      grantId: "grant-1",
      revokedByActorId: "admin-1",
      revokeReason: "team changed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected authorization role revoke to succeed");
    }
    expect(result.value.grant.status).toBe("REVOKED");
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "AuthorizationRoleGranted",
      "AuthorizationRoleRevoked",
    ]);
  });
});
