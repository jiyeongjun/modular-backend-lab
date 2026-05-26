export type NotificationChannel = "EMAIL" | "SMS" | "SLACK" | "WEBHOOK";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

export type NotificationPayloadValue = string | number | boolean | null;

export type NotificationPayload = Readonly<Record<string, NotificationPayloadValue>>;

type NotificationBase = Readonly<{
  id: string;
  idempotencyKey: string;
  channel: NotificationChannel;
  recipient: string;
  templateKey: string;
  payload: NotificationPayload;
  attemptCount: number;
  requestedAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type PendingNotification = NotificationBase &
  Readonly<{
    status: "PENDING";
    providerMessageId: null;
    lastFailureCode: null;
    lastFailureMessage: null;
    sentAt: null;
    failedAt: null;
  }>;

export type SentNotification = NotificationBase &
  Readonly<{
    status: "SENT";
    providerMessageId: string;
    lastFailureCode: null;
    lastFailureMessage: null;
    sentAt: Date;
    failedAt: null;
  }>;

export type FailedNotification = NotificationBase &
  Readonly<{
    status: "FAILED";
    providerMessageId: null;
    lastFailureCode: string;
    lastFailureMessage: string;
    sentAt: null;
    failedAt: Date;
  }>;

export type Notification = PendingNotification | SentNotification | FailedNotification;
