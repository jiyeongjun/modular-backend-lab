import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type {
  CheckAuthorizationUseCase,
  GrantAuthorizationRoleUseCase,
  RevokeAuthorizationRoleUseCase,
} from "../application/index.js";
import type { ActiveRoleGrant } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");

function createActiveGrant(): ActiveRoleGrant {
  return {
    id: "grant-1",
    actorId: "actor-1",
    role: "SUPPORT_AGENT",
    idempotencyKey: "grant-role-1",
    status: "ACTIVE",
    grantedByActorId: "admin-1",
    grantReason: "support team member",
    revokedByActorId: null,
    revokeReason: null,
    grantedAt: now,
    revokedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp(overrides: {
  grantAuthorizationRoleUseCase?: GrantAuthorizationRoleUseCase;
  revokeAuthorizationRoleUseCase?: RevokeAuthorizationRoleUseCase;
  checkAuthorizationUseCase?: CheckAuthorizationUseCase;
}) {
  return createRouteTestApp({
    grantAuthorizationRoleUseCase:
      overrides.grantAuthorizationRoleUseCase ??
      (async () => ok({ grant: createActiveGrant(), idempotent: false })),
    revokeAuthorizationRoleUseCase:
      overrides.revokeAuthorizationRoleUseCase ??
      (async () =>
        ok({
          grant: {
            ...createActiveGrant(),
            status: "REVOKED",
            revokedByActorId: "admin-1",
            revokeReason: "team changed",
            revokedAt: now,
            updatedAt: now,
          },
          idempotent: false,
        })),
    checkAuthorizationUseCase:
      overrides.checkAuthorizationUseCase ??
      (async () =>
        ok({
          decision: {
            allowed: true,
            actorId: "actor-1",
            permission: "support-ticket:assign",
            resource: { type: "SUPPORT_TICKET", id: "ticket-1" },
            matchedRole: "SUPPORT_AGENT",
            reason: "RoleAllowsPermission",
          },
        })),
  });
}

function validGrantBody(): string {
  return JSON.stringify({
    actorId: "actor-1",
    role: "SUPPORT_AGENT",
    idempotencyKey: "grant-role-1",
    grantedByActorId: "admin-1",
    grantReason: "support team member",
  });
}

describe("authorization routes", () => {
  it("returns 201 when a role is granted", async () => {
    const app = createTestApp({});

    const response = await app.request("/authorization/role-grants", {
      method: "POST",
      body: validGrantBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid role grant request body", async () => {
    const app = createTestApp({});

    const response = await app.request("/authorization/role-grants", {
      method: "POST",
      body: JSON.stringify({
        actorId: "actor-1",
        role: "SUPPORT_AGENT",
        idempotencyKey: "",
        grantedByActorId: "admin-1",
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 200 when authorization is checked", async () => {
    const app = createTestApp({});

    const response = await app.request("/authorization/check", {
      method: "POST",
      body: JSON.stringify({
        actorId: "actor-1",
        permission: "support-ticket:assign",
        resource: { type: "SUPPORT_TICKET", id: "ticket-1" },
      }),
      headers: { "content-type": "application/json" },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ data: { allowed: true } });
  });

  it("maps missing role grant to 404", async () => {
    const app = createTestApp({
      revokeAuthorizationRoleUseCase: async () =>
        err({
          type: "AuthorizationRoleGrantNotFound",
          grantId: "missing-grant",
          message: "Authorization role grant was not found",
        }),
    });

    const response = await app.request("/authorization/role-grants/missing-grant/revoke", {
      method: "POST",
      body: JSON.stringify({ revokedByActorId: "admin-1", revokeReason: "team changed" }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(404);
  });
});
