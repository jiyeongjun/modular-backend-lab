import { describe, expect, it } from "vitest";
import { isDockerAvailable, withTestDatabase } from "../../../../test/integration/test-db.js";
import {
  createNotification,
  markNotificationSent,
  notificationRequestedEvent,
} from "../domain/index.js";
import {
  createKyselyNotificationOutboxRepository,
  createKyselyNotificationRepository,
} from "../infra/index.js";

const dockerAvailable = isDockerAvailable();
const now = new Date("2026-01-01T00:00:00.000Z");
const later = new Date("2026-01-01T00:10:00.000Z");

function createNotificationFixture() {
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

describe.runIf(dockerAvailable)("notification repository integration", () => {
  it("persists notification projections, domain events, and outbox rows", async () => {
    await withTestDatabase(async (db) => {
      const notifications = createKyselyNotificationRepository(db);
      const outbox = createKyselyNotificationOutboxRepository(db);
      const notification = createNotificationFixture();
      const requestedEvents = [notificationRequestedEvent(notification)];
      await notifications.create(notification, requestedEvents);
      await outbox.saveAll(requestedEvents);

      const loaded = await notifications.findByIdForUpdate("notification-1");
      if (loaded === null) {
        throw new Error("expected notification to be loaded");
      }
      const sent = markNotificationSent(loaded, {
        providerMessageId: "provider-message-1",
        now: later,
      });
      if (!sent.ok) {
        throw new Error("expected notification to be marked sent");
      }
      await notifications.save(sent.value.notification, sent.value.events);
      await outbox.saveAll(sent.value.events);

      const saved = await notifications.findById("notification-1");
      const domainEventRows = await db
        .selectFrom("domain_events")
        .selectAll()
        .where("aggregate_type", "=", "Notification")
        .where("aggregate_id", "=", "notification-1")
        .orderBy("aggregate_version", "asc")
        .execute();
      const outboxRows = await db
        .selectFrom("outbox_events")
        .selectAll()
        .where("aggregate_type", "=", "Notification")
        .where("aggregate_id", "=", "notification-1")
        .orderBy("occurred_at", "asc")
        .execute();

      expect(saved?.status).toBe("SENT");
      expect(saved?.providerMessageId).toBe("provider-message-1");
      expect(saved?.version).toBe(1);
      expect(domainEventRows.map((row) => row.event_type)).toEqual([
        "NotificationRequested",
        "NotificationSent",
      ]);
      expect(outboxRows.map((row) => row.event_type)).toEqual([
        "NotificationRequested",
        "NotificationSent",
      ]);
    });
  });
});

describe.runIf(!dockerAvailable)("notification repository integration prerequisites", () => {
  it("documents that Docker is required for notification repository integration tests", () => {
    expect(dockerAvailable).toBe(false);
  });
});
