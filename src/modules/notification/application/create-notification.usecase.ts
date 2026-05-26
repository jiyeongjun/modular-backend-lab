import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateNotificationError,
  createNotification,
  type Notification,
  type NotificationChannel,
  type NotificationPayload,
  notificationRequestedEvent,
} from "../domain/index.js";
import type { NotificationUnitOfWork } from "../ports/index.js";

export type CreateNotificationCommand = Readonly<{
  idempotencyKey: string;
  channel: NotificationChannel;
  recipient: string;
  templateKey: string;
  payload: NotificationPayload;
}>;

export type CreateNotificationUseCaseError =
  | CreateNotificationError
  | {
      type: "NotificationIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    };

export type CreateNotificationUseCaseResult = Readonly<{
  notification: Notification;
  idempotent: boolean;
}>;

export type CreateNotificationUseCase = (
  command: CreateNotificationCommand,
) => Promise<Result<CreateNotificationUseCaseResult, CreateNotificationUseCaseError>>;

export function createCreateNotificationUseCase(deps: {
  uow: NotificationUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): CreateNotificationUseCase {
  return async function createNotificationUseCase(command) {
    return deps.uow.withTransaction<
      CreateNotificationUseCaseResult,
      CreateNotificationUseCaseError
    >(async ({ notifications, outbox }) => {
      const existing = await notifications.findByIdempotencyKey(command.idempotencyKey);
      if (existing !== null) {
        if (
          existing.channel !== command.channel ||
          existing.recipient !== command.recipient ||
          existing.templateKey !== command.templateKey
        ) {
          return err({
            type: "NotificationIdempotencyConflict",
            idempotencyKey: command.idempotencyKey,
            message: "Notification idempotency key belongs to another command",
          });
        }

        return ok({ notification: existing, idempotent: true });
      }

      const created = createNotification({
        id: deps.generateId(),
        idempotencyKey: command.idempotencyKey,
        channel: command.channel,
        recipient: command.recipient,
        templateKey: command.templateKey,
        payload: command.payload,
        now: deps.now(),
      });

      if (!created.ok) {
        return err(created.error);
      }

      const events = [notificationRequestedEvent(created.value)];
      await notifications.create(created.value, events);
      await outbox.saveAll(events);

      return ok({ notification: created.value, idempotent: false });
    });
  };
}
