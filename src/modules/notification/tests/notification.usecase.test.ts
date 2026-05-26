import { describe, expect, it } from "vitest";
import { err, ok } from "../../../shared/result/index.js";
import {
  createCreateNotificationUseCase,
  createSendNotificationUseCase,
} from "../application/index.js";
import type { Notification, NotificationEvent } from "../domain/index.js";
import type {
  NotificationOutboxRepository,
  NotificationRepository,
  NotificationSender,
  NotificationUnitOfWork,
} from "../ports/index.js";

const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createFakeUow(): {
  uow: NotificationUnitOfWork;
  notifications: Notification[];
  outboxEvents: NotificationEvent[];
} {
  const notificationState: Notification[] = [];
  const outboxEvents: NotificationEvent[] = [];

  function findBy(predicate: (notification: Notification) => boolean): Notification | null {
    return notificationState.find(predicate) ?? null;
  }

  const notifications: NotificationRepository = {
    findById: async (id) => findBy((notification) => notification.id === id),
    findByIdForUpdate: async (id) => findBy((notification) => notification.id === id),
    findByIdempotencyKey: async (idempotencyKey) =>
      findBy((notification) => notification.idempotencyKey === idempotencyKey),
    create: async (notification) => {
      notificationState.push(notification);
    },
    save: async (notification) => {
      const index = notificationState.findIndex((current) => current.id === notification.id);
      if (index === -1) {
        throw new Error("notification missing");
      }
      notificationState[index] = notification;
    },
  };

  const outbox: NotificationOutboxRepository = {
    saveAll: async (events) => {
      outboxEvents.push(...events);
    },
  };

  return {
    uow: {
      async withTransaction(work) {
        return work({ notifications, outbox });
      },
    },
    notifications: notificationState,
    outboxEvents,
  };
}

async function createNotificationFixture(fake: ReturnType<typeof createFakeUow>): Promise<void> {
  const createNotification = createCreateNotificationUseCase({
    uow: fake.uow,
    now: () => now,
    generateId: () => "notification-1",
  });
  const result = await createNotification({
    idempotencyKey: "notify-1",
    channel: "EMAIL",
    recipient: "customer@example.com",
    templateKey: "return.authorized",
    payload: { orderId: "order-1", rmaNumber: "RMA-1" },
  });
  if (!result.ok) {
    throw new Error("expected notification fixture to be created");
  }
}

describe("notification usecases", () => {
  it("creates notification requests idempotently by idempotency key", async () => {
    const fake = createFakeUow();
    const createNotification = createCreateNotificationUseCase({
      uow: fake.uow,
      now: () => now,
      generateId: () => "notification-1",
    });

    const first = await createNotification({
      idempotencyKey: "notify-1",
      channel: "EMAIL",
      recipient: "customer@example.com",
      templateKey: "return.authorized",
      payload: { orderId: "order-1", rmaNumber: "RMA-1" },
    });
    const second = await createNotification({
      idempotencyKey: "notify-1",
      channel: "EMAIL",
      recipient: "customer@example.com",
      templateKey: "return.authorized",
      payload: { orderId: "order-1", rmaNumber: "RMA-1" },
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      throw new Error("expected notification creation to succeed");
    }
    expect(first.value.idempotent).toBe(false);
    expect(second.value.idempotent).toBe(true);
    expect(fake.notifications).toHaveLength(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual(["NotificationRequested"]);
  });

  it("sends pending notifications through the sender port", async () => {
    const fake = createFakeUow();
    await createNotificationFixture(fake);
    const sender: NotificationSender = {
      send: async () => ok({ providerMessageId: "provider-message-1" }),
    };
    const sendNotification = createSendNotificationUseCase({
      uow: fake.uow,
      sender,
      now: () => later,
    });

    const result = await sendNotification({ notificationId: "notification-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected send to succeed");
    }
    expect(result.value.notification.status).toBe("SENT");
    expect(result.value.notification.providerMessageId).toBe("provider-message-1");
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "NotificationRequested",
      "NotificationSent",
    ]);
  });

  it("records provider failures and leaves notification retryable", async () => {
    const fake = createFakeUow();
    await createNotificationFixture(fake);
    const sender: NotificationSender = {
      send: async () =>
        err({
          code: "PROVIDER_TIMEOUT",
          message: "Provider timed out",
          retryable: true,
        }),
    };
    const sendNotification = createSendNotificationUseCase({
      uow: fake.uow,
      sender,
      now: () => later,
    });

    const result = await sendNotification({ notificationId: "notification-1" });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected provider failure");
    }
    expect(result.error.type).toBe("NotificationProviderRejected");
    expect(fake.notifications[0]?.status).toBe("FAILED");
    expect(fake.notifications[0]?.attemptCount).toBe(1);
    expect(fake.outboxEvents.map((event) => event.type)).toEqual([
      "NotificationRequested",
      "NotificationSendFailed",
    ]);
  });
});
