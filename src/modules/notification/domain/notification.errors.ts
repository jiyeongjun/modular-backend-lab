import type { NotificationStatus } from "./notification.js";

export type InvalidNotificationInput = Readonly<{
  type: "InvalidNotificationInput";
  message: string;
}>;

export type NotificationNotSendable = Readonly<{
  type: "NotificationNotSendable";
  status: NotificationStatus;
  message: string;
}>;

export type CreateNotificationError = InvalidNotificationInput;

export type MarkNotificationSentError = InvalidNotificationInput | NotificationNotSendable;

export type MarkNotificationFailedError = InvalidNotificationInput | NotificationNotSendable;
