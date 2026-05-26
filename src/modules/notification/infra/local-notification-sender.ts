import { ok } from "../../../shared/result/index.js";
import type { NotificationSender } from "../ports/index.js";

export function createLocalNotificationSender(): NotificationSender {
  return {
    async send(request) {
      return ok({
        providerMessageId: `local:${request.notificationId}:${request.attempt}`,
      });
    },
  };
}
