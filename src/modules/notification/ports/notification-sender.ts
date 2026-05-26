import type { Result } from "../../../shared/result/index.js";
import type { NotificationChannel, NotificationPayload } from "../domain/index.js";

export type NotificationSendRequest = Readonly<{
  notificationId: string;
  channel: NotificationChannel;
  recipient: string;
  templateKey: string;
  payload: NotificationPayload;
  attempt: number;
}>;

export type NotificationSendSuccess = Readonly<{
  providerMessageId: string;
}>;

export type NotificationSendFailure = Readonly<{
  code: string;
  message: string;
  retryable: boolean;
}>;

export type NotificationSender = {
  send(
    request: NotificationSendRequest,
  ): Promise<Result<NotificationSendSuccess, NotificationSendFailure>>;
};
