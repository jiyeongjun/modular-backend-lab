import type {
  NotificationRequestInsert,
  NotificationRequestRow,
  NotificationRequestUpdate,
} from "../../../infra/db/database.js";
import type {
  FailedNotification,
  Notification,
  NotificationChannel,
  NotificationPayload,
  NotificationPayloadValue,
  NotificationStatus,
  PendingNotification,
  SentNotification,
} from "../domain/index.js";

function toChannel(value: string): NotificationChannel {
  if (value === "EMAIL" || value === "SMS" || value === "SLACK" || value === "WEBHOOK") {
    return value;
  }
  throw new Error(`Unknown notification channel: ${value}`);
}

function toStatus(value: string): NotificationStatus {
  if (value === "PENDING" || value === "SENT" || value === "FAILED") {
    return value;
  }
  throw new Error(`Unknown notification status: ${value}`);
}

function isPayloadValue(value: unknown): value is NotificationPayloadValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  );
}

function toPayload(value: unknown): NotificationPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Notification payload must be a JSON object");
  }

  const payload: Record<string, NotificationPayloadValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isPayloadValue(entry)) {
      throw new Error("Notification payload values must be primitive JSON values");
    }
    payload[key] = entry;
  }

  return payload;
}

function base(row: NotificationRequestRow) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    channel: toChannel(row.channel),
    recipient: row.recipient,
    templateKey: row.template_key,
    payload: toPayload(row.payload),
    attemptCount: row.attempt_count,
    requestedAt: row.requested_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toNotification(row: NotificationRequestRow): Notification {
  switch (toStatus(row.status)) {
    case "PENDING": {
      if (
        row.provider_message_id !== null ||
        row.last_failure_code !== null ||
        row.last_failure_message !== null ||
        row.sent_at !== null ||
        row.failed_at !== null
      ) {
        throw new Error(`Pending notification ${row.id} has non-pending columns`);
      }
      const notification: PendingNotification = {
        ...base(row),
        status: "PENDING",
        providerMessageId: null,
        lastFailureCode: null,
        lastFailureMessage: null,
        sentAt: null,
        failedAt: null,
      };
      return notification;
    }

    case "SENT": {
      if (
        row.provider_message_id === null ||
        row.last_failure_code !== null ||
        row.last_failure_message !== null ||
        row.sent_at === null ||
        row.failed_at !== null
      ) {
        throw new Error(`Sent notification ${row.id} has invalid columns`);
      }
      const notification: SentNotification = {
        ...base(row),
        status: "SENT",
        providerMessageId: row.provider_message_id,
        lastFailureCode: null,
        lastFailureMessage: null,
        sentAt: row.sent_at,
        failedAt: null,
      };
      return notification;
    }

    case "FAILED": {
      if (
        row.provider_message_id !== null ||
        row.last_failure_code === null ||
        row.last_failure_message === null ||
        row.sent_at !== null ||
        row.failed_at === null
      ) {
        throw new Error(`Failed notification ${row.id} has invalid columns`);
      }
      const notification: FailedNotification = {
        ...base(row),
        status: "FAILED",
        providerMessageId: null,
        lastFailureCode: row.last_failure_code,
        lastFailureMessage: row.last_failure_message,
        sentAt: null,
        failedAt: row.failed_at,
      };
      return notification;
    }
  }
}

export function toNotificationInsert(notification: Notification): NotificationRequestInsert {
  return {
    id: notification.id,
    idempotency_key: notification.idempotencyKey,
    channel: notification.channel,
    recipient: notification.recipient,
    template_key: notification.templateKey,
    payload: JSON.stringify(notification.payload),
    status: notification.status,
    provider_message_id: notification.providerMessageId,
    last_failure_code: notification.lastFailureCode,
    last_failure_message: notification.lastFailureMessage,
    attempt_count: notification.attemptCount,
    requested_at: notification.requestedAt,
    sent_at: notification.sentAt,
    failed_at: notification.failedAt,
    version: notification.version,
    created_at: notification.createdAt,
    updated_at: notification.updatedAt,
  };
}

export function toNotificationUpdate(notification: Notification): NotificationRequestUpdate {
  return {
    status: notification.status,
    provider_message_id: notification.providerMessageId,
    last_failure_code: notification.lastFailureCode,
    last_failure_message: notification.lastFailureMessage,
    attempt_count: notification.attemptCount,
    sent_at: notification.sentAt,
    failed_at: notification.failedAt,
    updated_at: notification.updatedAt,
  };
}
