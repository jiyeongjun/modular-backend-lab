import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  DisableEmailCredentialUseCase,
  LoginWithEmailUseCase,
  RegisterEmailCredentialUseCase,
  RevokeAuthSessionUseCase,
  VerifyAuthSessionUseCase,
} from "../application/index.js";
import {
  mapDisableEmailCredentialResult,
  mapLoginWithEmailResult,
  mapRegisterEmailCredentialResult,
  mapRevokeAuthSessionResult,
  mapVerifyAuthSessionResult,
} from "./auth.response.js";
import {
  AuthCredentialParamsSchema,
  AuthTokenBodySchema,
  LoginWithEmailBodySchema,
  RegisterEmailCredentialBodySchema,
} from "./auth.schemas.js";

export function createAuthRoutes(deps: {
  registerEmailCredentialUseCase: RegisterEmailCredentialUseCase;
  loginWithEmailUseCase: LoginWithEmailUseCase;
  verifyAuthSessionUseCase: VerifyAuthSessionUseCase;
  revokeAuthSessionUseCase: RevokeAuthSessionUseCase;
  disableEmailCredentialUseCase: DisableEmailCredentialUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/auth/email/register", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = RegisterEmailCredentialBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid email credential registration request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.registerEmailCredentialUseCase(body.data);
    const response = mapRegisterEmailCredentialResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/auth/email/login", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = LoginWithEmailBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid email login request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.loginWithEmailUseCase(body.data);
    const response = mapLoginWithEmailResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/auth/sessions/verify", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = AuthTokenBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid auth session verification request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.verifyAuthSessionUseCase(body.data);
    const response = mapVerifyAuthSessionResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/auth/sessions/revoke", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = AuthTokenBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid auth session revocation request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.revokeAuthSessionUseCase(body.data);
    const response = mapRevokeAuthSessionResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/auth/credentials/:credentialId/disable", async (c) => {
    const params = AuthCredentialParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid auth credential disable request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.disableEmailCredentialUseCase({
      credentialId: params.data.credentialId,
    });
    const response = mapDisableEmailCredentialResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
