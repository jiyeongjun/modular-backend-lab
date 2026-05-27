import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  CheckAuthorizationUseCase,
  GrantAuthorizationRoleUseCase,
  RevokeAuthorizationRoleUseCase,
} from "../application/index.js";
import {
  mapCheckAuthorizationResult,
  mapGrantAuthorizationRoleResult,
  mapRevokeAuthorizationRoleResult,
} from "./authorization.response.js";
import {
  AuthorizationRoleGrantParamsSchema,
  CheckAuthorizationBodySchema,
  GrantAuthorizationRoleBodySchema,
  RevokeAuthorizationRoleBodySchema,
} from "./authorization.schemas.js";

export function createAuthorizationRoutes(deps: {
  grantAuthorizationRoleUseCase: GrantAuthorizationRoleUseCase;
  revokeAuthorizationRoleUseCase: RevokeAuthorizationRoleUseCase;
  checkAuthorizationUseCase: CheckAuthorizationUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/authorization/role-grants", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = GrantAuthorizationRoleBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid authorization role grant request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.grantAuthorizationRoleUseCase({
      ...body.data,
      grantReason: body.data.grantReason ?? null,
    });
    const response = mapGrantAuthorizationRoleResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/authorization/role-grants/:grantId/revoke", async (c) => {
    const params = AuthorizationRoleGrantParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = RevokeAuthorizationRoleBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid authorization role revoke request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.revokeAuthorizationRoleUseCase({
      grantId: params.data.grantId,
      revokedByActorId: body.data.revokedByActorId,
      revokeReason: body.data.revokeReason,
    });
    const response = mapRevokeAuthorizationRoleResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/authorization/check", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CheckAuthorizationBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid authorization check request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.checkAuthorizationUseCase({
      actorId: body.data.actorId,
      permission: body.data.permission,
      resource: {
        type: body.data.resource.type,
        id: body.data.resource.id ?? null,
      },
    });
    const response = mapCheckAuthorizationResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
