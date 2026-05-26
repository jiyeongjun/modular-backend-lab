import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type MarkNotificationFailedError,
  type MarkNotificationSentError,
  markNotificationFailed,
  markNotificationSent,
  type Notification,
} from "../domain/index.js";
import type {
  NotificationSender,
  NotificationSendFailure,
  NotificationUnitOfWork,
} from "../ports/index.js";

export type SendNotificationCommand = Readonly<{
  notificationId: string;
}>;

export type NotificationProviderRejected = Readonly<{
  type: "NotificationProviderRejected";
  providerCode: string;
  providerMessage: string;
  retryable: boolean;
  message: string;
}>;

export type SendNotificationUseCaseError =
  | MarkNotificationFailedError
  | MarkNotificationSentError
  | NotificationProviderRejected
  | {
      type: "NotificationNotFound";
      notificationId: string;
      message: string;
    };

export type SendNotificationUseCaseResult = Readonly<{
  notification: Notification;
  idempotent: boolean;
}>;

export type SendNotificationUseCase = (
  command: SendNotificationCommand,
) => Promise<Result<SendNotificationUseCaseResult, SendNotificationUseCaseError>>;

export function createSendNotificationUseCase(deps: {
  uow: NotificationUnitOfWork;
  sender: NotificationSender;
  now: () => Date;
}): SendNotificationUseCase {
  return async function sendNotificationUseCase(command) {
    const notification = await deps.uow.withTransaction<Notification, SendNotificationUseCaseError>(
      async ({ notifications }) => {
        const current = await notifications.findById(command.notificationId);
        if (current === null) {
          return err({
            type: "NotificationNotFound",
            notificationId: command.notificationId,
            message: "Notification was not found",
          });
        }

        return ok(current);
      },
    );

    if (!notification.ok) {
      return notification;
    }

    if (notification.value.status === "SENT") {
      return ok({ notification: notification.value, idempotent: true });
    }

    const senderResult = await deps.sender.send({
      notificationId: notification.value.id,
      channel: notification.value.channel,
      recipient: notification.value.recipient,
      templateKey: notification.value.templateKey,
      payload: notification.value.payload,
      attempt: notification.value.attemptCount + 1,
    });

    if (!senderResult.ok) {
      return recordSendFailure(command.notificationId, senderResult.error);
    }

    return deps.uow.withTransaction<SendNotificationUseCaseResult, SendNotificationUseCaseError>(
      async ({ notifications, outbox }) => {
        const current = await notifications.findByIdForUpdate(command.notificationId);
        if (current === null) {
          return err({
            type: "NotificationNotFound",
            notificationId: command.notificationId,
            message: "Notification was not found",
          });
        }

        if (current.status === "SENT") {
          return ok({ notification: current, idempotent: true });
        }

        const sent = markNotificationSent(current, {
          providerMessageId: senderResult.value.providerMessageId,
          now: deps.now(),
        });
        if (!sent.ok) {
          return err(sent.error);
        }

        await notifications.save(sent.value.notification, sent.value.events);
        await outbox.saveAll(sent.value.events);

        return ok({ notification: sent.value.notification, idempotent: false });
      },
    );

    async function recordSendFailure(
      notificationId: string,
      failure: NotificationSendFailure,
    ): Promise<Result<SendNotificationUseCaseResult, SendNotificationUseCaseError>> {
      await deps.uow.withTransaction<undefined, never>(async ({ notifications, outbox }) => {
        const current = await notifications.findByIdForUpdate(notificationId);
        if (current === null || current.status === "SENT") {
          return ok(undefined);
        }

        const failed = markNotificationFailed(current, {
          code: failure.code,
          message: failure.message,
          now: deps.now(),
        });
        if (!failed.ok) {
          return ok(undefined);
        }

        await notifications.save(failed.value.notification, failed.value.events);
        await outbox.saveAll(failed.value.events);

        return ok(undefined);
      });

      return err({
        type: "NotificationProviderRejected",
        providerCode: failure.code,
        providerMessage: failure.message,
        retryable: failure.retryable,
        message: "Notification provider rejected the request",
      });
    }
  };
}
