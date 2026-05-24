import type { QueueMessage } from "./queue-message.js";

export type QueuePublisher = {
  publish(message: QueueMessage): Promise<void>;
};
