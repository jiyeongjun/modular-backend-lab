import type { NotificationChannel, NotificationPayload } from "./notification.js";

export type NotificationRequested = Readonly<{
  type: "NotificationRequested";
  aggregateType: "Notification";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    notificationId: string;
    idempotencyKey: string;
    channel: NotificationChannel;
    recipient: string;
    templateKey: string;
    payload: NotificationPayload;
    requestedAt: Date;
  };
}>;

export type NotificationSent = Readonly<{
  type: "NotificationSent";
  aggregateType: "Notification";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    notificationId: string;
    channel: NotificationChannel;
    recipient: string;
    templateKey: string;
    providerMessageId: string;
    sentAt: Date;
    attemptCount: number;
  };
}>;

export type NotificationSendFailed = Readonly<{
  type: "NotificationSendFailed";
  aggregateType: "Notification";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    notificationId: string;
    channel: NotificationChannel;
    recipient: string;
    templateKey: string;
    failureCode: string;
    failureMessage: string;
    failedAt: Date;
    attemptCount: number;
  };
}>;

export type NotificationEvent = NotificationRequested | NotificationSent | NotificationSendFailed;
