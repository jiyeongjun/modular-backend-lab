import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CreateNotificationError,
  InvalidNotificationInput,
  MarkNotificationFailedError,
  MarkNotificationSentError,
} from "./notification.errors.js";
import type { NotificationEvent } from "./notification.events.js";
import type {
  FailedNotification,
  Notification,
  NotificationChannel,
  NotificationPayload,
  PendingNotification,
  SentNotification,
} from "./notification.js";

export type CreateNotificationInput = Readonly<{
  id: string;
  idempotencyKey: string;
  channel: NotificationChannel;
  recipient: string;
  templateKey: string;
  payload: NotificationPayload;
  now: Date;
}>;

export type NotificationTransition<T extends Notification> = Readonly<{
  notification: T;
  events: readonly NotificationEvent[];
}>;

export function createNotification(
  input: CreateNotificationInput,
): Result<PendingNotification, CreateNotificationError> {
  const invalidInput = validateRequiredFields([
    input.id,
    input.idempotencyKey,
    input.recipient,
    input.templateKey,
  ]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  return ok({
    id: input.id,
    idempotencyKey: input.idempotencyKey,
    channel: input.channel,
    recipient: input.recipient,
    templateKey: input.templateKey,
    payload: input.payload,
    status: "PENDING",
    providerMessageId: null,
    lastFailureCode: null,
    lastFailureMessage: null,
    attemptCount: 0,
    requestedAt: input.now,
    sentAt: null,
    failedAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function notificationRequestedEvent(notification: PendingNotification): NotificationEvent {
  return {
    type: "NotificationRequested",
    aggregateType: "Notification",
    aggregateId: notification.id,
    occurredAt: notification.requestedAt,
    payload: {
      notificationId: notification.id,
      idempotencyKey: notification.idempotencyKey,
      channel: notification.channel,
      recipient: notification.recipient,
      templateKey: notification.templateKey,
      payload: notification.payload,
      requestedAt: notification.requestedAt,
    },
  };
}

export function markNotificationSent(
  notification: Notification,
  input: Readonly<{ providerMessageId: string; now: Date }>,
): Result<NotificationTransition<SentNotification>, MarkNotificationSentError> {
  if (input.providerMessageId.trim().length === 0) {
    return err({
      type: "InvalidNotificationInput",
      message: "Provider message id is required",
    });
  }

  switch (notification.status) {
    case "PENDING":
    case "FAILED": {
      const sent: SentNotification = {
        ...notification,
        status: "SENT",
        providerMessageId: input.providerMessageId,
        lastFailureCode: null,
        lastFailureMessage: null,
        attemptCount: notification.attemptCount + 1,
        sentAt: input.now,
        failedAt: null,
        updatedAt: input.now,
      };
      return ok({
        notification: sent,
        events: [
          {
            type: "NotificationSent",
            aggregateType: "Notification",
            aggregateId: sent.id,
            occurredAt: input.now,
            payload: {
              notificationId: sent.id,
              channel: sent.channel,
              recipient: sent.recipient,
              templateKey: sent.templateKey,
              providerMessageId: sent.providerMessageId,
              sentAt: sent.sentAt,
              attemptCount: sent.attemptCount,
            },
          },
        ],
      });
    }

    case "SENT":
      return ok({ notification, events: [] });
  }
}

export function markNotificationFailed(
  notification: Notification,
  input: Readonly<{ code: string; message: string; now: Date }>,
): Result<NotificationTransition<FailedNotification>, MarkNotificationFailedError> {
  const invalidInput = validateRequiredFields([input.code, input.message]);
  if (invalidInput !== null) {
    return err(invalidInput);
  }

  switch (notification.status) {
    case "PENDING":
    case "FAILED": {
      const failed: FailedNotification = {
        ...notification,
        status: "FAILED",
        providerMessageId: null,
        lastFailureCode: input.code,
        lastFailureMessage: input.message,
        attemptCount: notification.attemptCount + 1,
        sentAt: null,
        failedAt: input.now,
        updatedAt: input.now,
      };
      return ok({
        notification: failed,
        events: [
          {
            type: "NotificationSendFailed",
            aggregateType: "Notification",
            aggregateId: failed.id,
            occurredAt: input.now,
            payload: {
              notificationId: failed.id,
              channel: failed.channel,
              recipient: failed.recipient,
              templateKey: failed.templateKey,
              failureCode: failed.lastFailureCode,
              failureMessage: failed.lastFailureMessage,
              failedAt: failed.failedAt,
              attemptCount: failed.attemptCount,
            },
          },
        ],
      });
    }

    case "SENT":
      return err({
        type: "NotificationNotSendable",
        status: notification.status,
        message: "Sent notifications cannot be marked failed",
      });
  }
}

function validateRequiredFields(values: readonly string[]): InvalidNotificationInput | null {
  if (values.some((value) => value.trim().length === 0)) {
    return {
      type: "InvalidNotificationInput",
      message: "Notification fields must be non-empty",
    };
  }

  return null;
}
