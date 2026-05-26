import type { Result } from "../../../shared/result/index.js";
import type {
  CreateNotificationUseCaseError,
  CreateNotificationUseCaseResult,
  SendNotificationUseCaseError,
  SendNotificationUseCaseResult,
} from "../application/index.js";
import type { Notification } from "../domain/index.js";

export type NotificationHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409 | 502;
  body: unknown;
}>;

export function serializeNotification(notification: Notification): Record<string, unknown> {
  return {
    id: notification.id,
    idempotencyKey: notification.idempotencyKey,
    channel: notification.channel,
    recipient: notification.recipient,
    templateKey: notification.templateKey,
    payload: notification.payload,
    status: notification.status,
    providerMessageId: notification.providerMessageId,
    lastFailureCode: notification.lastFailureCode,
    lastFailureMessage: notification.lastFailureMessage,
    attemptCount: notification.attemptCount,
    requestedAt: notification.requestedAt.toISOString(),
    sentAt: notification.sentAt?.toISOString() ?? null,
    failedAt: notification.failedAt?.toISOString() ?? null,
    version: notification.version,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  };
}

export function mapCreateNotificationResult(
  result: Result<CreateNotificationUseCaseResult, CreateNotificationUseCaseError>,
): NotificationHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeNotification(result.value.notification),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapNotificationError(result.error);
}

export function mapSendNotificationResult(
  result: Result<SendNotificationUseCaseResult, SendNotificationUseCaseError>,
): NotificationHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeNotification(result.value.notification),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapNotificationError(result.error);
}

function mapNotificationError(
  error: CreateNotificationUseCaseError | SendNotificationUseCaseError,
): NotificationHttpResponseShape {
  switch (error.type) {
    case "InvalidNotificationInput":
      return { status: 400, body: { error } };

    case "NotificationNotFound":
      return { status: 404, body: { error } };

    case "NotificationIdempotencyConflict":
    case "NotificationNotSendable":
      return { status: 409, body: { error } };

    case "NotificationProviderRejected":
      return { status: 502, body: { error } };
  }
}
