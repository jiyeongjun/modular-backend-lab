import type { Result } from "../../../shared/result/index.js";
import type { NotificationRepository } from "./notification.repository.js";
import type { NotificationOutboxRepository } from "./notification-outbox.repository.js";

export type NotificationUnitOfWorkContext = Readonly<{
  notifications: NotificationRepository;
  outbox: NotificationOutboxRepository;
}>;

export type NotificationUnitOfWork = {
  withTransaction<TValue, TError>(
    work: (context: NotificationUnitOfWorkContext) => Promise<Result<TValue, TError>>,
  ): Promise<Result<TValue, TError>>;
};
