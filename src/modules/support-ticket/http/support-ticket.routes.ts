import { Hono } from "hono";
import type { AppBindings } from "../../../http/context.js";
import type {
  AssignSupportTicketUseCase,
  CloseSupportTicketUseCase,
  CreateSupportTicketUseCase,
  MarkSupportTicketWaitingUseCase,
  ResolveSupportTicketUseCase,
} from "../application/index.js";
import {
  mapAssignSupportTicketResult,
  mapCloseSupportTicketResult,
  mapCreateSupportTicketResult,
  mapMarkSupportTicketWaitingResult,
  mapResolveSupportTicketResult,
} from "./support-ticket.response.js";
import {
  AssignSupportTicketBodySchema,
  CreateSupportTicketBodySchema,
  ResolveSupportTicketBodySchema,
  SupportTicketParamsSchema,
} from "./support-ticket.schemas.js";

export function createSupportTicketRoutes(deps: {
  createSupportTicketUseCase: CreateSupportTicketUseCase;
  assignSupportTicketUseCase: AssignSupportTicketUseCase;
  markSupportTicketWaitingUseCase: MarkSupportTicketWaitingUseCase;
  resolveSupportTicketUseCase: ResolveSupportTicketUseCase;
  closeSupportTicketUseCase: CloseSupportTicketUseCase;
}): Hono<AppBindings> {
  const app = new Hono<AppBindings>();

  app.post("/support/tickets", async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = CreateSupportTicketBodySchema.safeParse(rawBody);
    if (!body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid support ticket create request",
            body: body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.createSupportTicketUseCase({
      ...body.data,
      orderId: body.data.orderId ?? null,
      returnId: body.data.returnId ?? null,
      refundId: body.data.refundId ?? null,
    });
    const response = mapCreateSupportTicketResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/support/tickets/:ticketId/assign", async (c) => {
    const params = SupportTicketParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = AssignSupportTicketBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid support ticket assign request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.assignSupportTicketUseCase({
      ticketId: params.data.ticketId,
      assigneeId: body.data.assigneeId,
    });
    const response = mapAssignSupportTicketResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/support/tickets/:ticketId/waiting-customer", async (c) => {
    const params = SupportTicketParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid support ticket waiting request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.markSupportTicketWaitingUseCase({
      ticketId: params.data.ticketId,
    });
    const response = mapMarkSupportTicketWaitingResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/support/tickets/:ticketId/resolve", async (c) => {
    const params = SupportTicketParamsSchema.safeParse(c.req.param());
    const rawBody: unknown = await c.req.json().catch(() => null);
    const body = ResolveSupportTicketBodySchema.safeParse(rawBody);
    if (!params.success || !body.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid support ticket resolve request",
            params: params.success ? undefined : params.error.flatten(),
            body: body.success ? undefined : body.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.resolveSupportTicketUseCase({
      ticketId: params.data.ticketId,
      resolution: body.data.resolution,
    });
    const response = mapResolveSupportTicketResult(result);

    return c.json(response.body, response.status);
  });

  app.post("/support/tickets/:ticketId/close", async (c) => {
    const params = SupportTicketParamsSchema.safeParse(c.req.param());
    if (!params.success) {
      return c.json(
        {
          error: {
            type: "InvalidRequest",
            message: "Invalid support ticket close request",
            params: params.error.flatten(),
          },
        },
        400,
      );
    }

    const result = await deps.closeSupportTicketUseCase({
      ticketId: params.data.ticketId,
    });
    const response = mapCloseSupportTicketResult(result);

    return c.json(response.body, response.status);
  });

  return app;
}
