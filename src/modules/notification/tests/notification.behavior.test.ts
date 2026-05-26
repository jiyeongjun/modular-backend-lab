import { describe, expect, it } from "vitest";
import {
  createNotification,
  markNotificationFailed,
  markNotificationSent,
  notificationRequestedEvent,
} from "../domain/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const failedAt = new Date("2026-01-01T00:05:00.000Z");
const sentAt = new Date("2026-01-01T00:10:00.000Z");

function createPendingNotification() {
  const created = createNotification({
    id: "notification-1",
    idempotencyKey: "notify-1",
    channel: "EMAIL",
    recipient: "customer@example.com",
    templateKey: "return.authorized",
    payload: { orderId: "order-1", rmaNumber: "RMA-1" },
    now,
  });
  if (!created.ok) {
    throw new Error("expected notification to be created");
  }
  return created.value;
}

describe("notification domain behavior", () => {
  it("creates a pending notification request event", () => {
    const notification = createPendingNotification();
    const event = notificationRequestedEvent(notification);

    expect(notification.status).toBe("PENDING");
    expect(notification.attemptCount).toBe(0);
    expect(event.type).toBe("NotificationRequested");
  });

  it("records failure and keeps the notification retryable", () => {
    const failed = markNotificationFailed(createPendingNotification(), {
      code: "PROVIDER_TIMEOUT",
      message: "Provider timed out",
      now: failedAt,
    });

    expect(failed.ok).toBe(true);
    if (!failed.ok) {
      throw new Error("expected failure to be recorded");
    }
    expect(failed.value.notification.status).toBe("FAILED");
    expect(failed.value.notification.attemptCount).toBe(1);
    expect(failed.value.events[0]?.type).toBe("NotificationSendFailed");
  });

  it("marks failed notifications as sent on a later retry", () => {
    const failed = markNotificationFailed(createPendingNotification(), {
      code: "PROVIDER_TIMEOUT",
      message: "Provider timed out",
      now: failedAt,
    });
    if (!failed.ok) {
      throw new Error("expected failure to be recorded");
    }

    const sent = markNotificationSent(failed.value.notification, {
      providerMessageId: "provider-message-1",
      now: sentAt,
    });

    expect(sent.ok).toBe(true);
    if (!sent.ok) {
      throw new Error("expected retry to succeed");
    }
    expect(sent.value.notification.status).toBe("SENT");
    expect(sent.value.notification.providerMessageId).toBe("provider-message-1");
    expect(sent.value.notification.lastFailureCode).toBeNull();
    expect(sent.value.notification.attemptCount).toBe(2);
  });
});
