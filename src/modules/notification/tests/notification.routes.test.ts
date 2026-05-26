import { describe, expect, it } from "vitest";
import { createRouteTestApp } from "../../../../test/http/create-test-app.js";
import { err, ok } from "../../../shared/result/index.js";
import type { CreateNotificationUseCase, SendNotificationUseCase } from "../application/index.js";
import type { PendingNotification, SentNotification } from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const sentAt = new Date("2026-01-01T00:10:00.000Z");

function createPendingNotification(): PendingNotification {
  return {
    id: "notification-1",
    idempotencyKey: "notify-1",
    channel: "EMAIL",
    recipient: "customer@example.com",
    templateKey: "return.authorized",
    payload: { orderId: "order-1", rmaNumber: "RMA-1" },
    status: "PENDING",
    providerMessageId: null,
    lastFailureCode: null,
    lastFailureMessage: null,
    attemptCount: 0,
    requestedAt: now,
    sentAt: null,
    failedAt: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function createSentNotification(): SentNotification {
  return {
    ...createPendingNotification(),
    status: "SENT",
    providerMessageId: "provider-message-1",
    attemptCount: 1,
    sentAt,
    updatedAt: sentAt,
  };
}

function createTestApp(overrides: {
  createNotificationUseCase?: CreateNotificationUseCase;
  sendNotificationUseCase?: SendNotificationUseCase;
}) {
  return createRouteTestApp({
    createNotificationUseCase:
      overrides.createNotificationUseCase ??
      (async () => ok({ notification: createPendingNotification(), idempotent: false })),
    sendNotificationUseCase:
      overrides.sendNotificationUseCase ??
      (async () => ok({ notification: createSentNotification(), idempotent: false })),
  });
}

function validCreateBody(): string {
  return JSON.stringify({
    idempotencyKey: "notify-1",
    channel: "EMAIL",
    recipient: "customer@example.com",
    templateKey: "return.authorized",
    payload: { orderId: "order-1", rmaNumber: "RMA-1" },
  });
}

describe("notification routes", () => {
  it("returns 201 when notification is created", async () => {
    const app = createTestApp({});

    const response = await app.request("/notifications", {
      method: "POST",
      body: validCreateBody(),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(201);
  });

  it("returns 400 for invalid notification request body", async () => {
    const app = createTestApp({});

    const response = await app.request("/notifications", {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: "notify-1",
        channel: "EMAIL",
        recipient: "",
        templateKey: "return.authorized",
        payload: {},
      }),
      headers: { "content-type": "application/json" },
    });

    expect(response.status).toBe(400);
  });

  it("returns 200 when notification send succeeds", async () => {
    const app = createTestApp({});

    const response = await app.request("/notifications/notification-1/send", { method: "POST" });

    expect(response.status).toBe(200);
  });

  it("maps missing notification to 404", async () => {
    const app = createTestApp({
      sendNotificationUseCase: async () =>
        err({
          type: "NotificationNotFound",
          notificationId: "missing-notification",
          message: "Notification was not found",
        }),
    });

    const response = await app.request("/notifications/missing-notification/send", {
      method: "POST",
    });

    expect(response.status).toBe(404);
  });

  it("maps provider failure to 502", async () => {
    const app = createTestApp({
      sendNotificationUseCase: async () =>
        err({
          type: "NotificationProviderRejected",
          providerCode: "PROVIDER_TIMEOUT",
          providerMessage: "Provider timed out",
          retryable: true,
          message: "Notification provider rejected the request",
        }),
    });

    const response = await app.request("/notifications/notification-1/send", { method: "POST" });

    expect(response.status).toBe(502);
  });
});
