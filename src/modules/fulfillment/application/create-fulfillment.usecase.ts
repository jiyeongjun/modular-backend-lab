import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateFulfillmentError,
  createFulfillment,
  type Fulfillment,
  fulfillmentCreatedEvent,
  type ShipmentPackage,
  type ShippingAddress,
} from "../domain/index.js";
import type { FulfillmentUnitOfWork } from "../ports/index.js";

export type CreateFulfillmentCommand = Readonly<{
  orderId: string;
  idempotencyKey: string;
  recipient: ShippingAddress;
  package: ShipmentPackage;
}>;

export type CreateFulfillmentUseCaseError =
  | CreateFulfillmentError
  | {
      type: "FulfillmentAlreadyExists";
      orderId: string;
      message: string;
    };

export type CreateFulfillmentUseCaseResult = Readonly<{
  fulfillment: Fulfillment;
  idempotent: boolean;
}>;

export type CreateFulfillmentUseCase = (
  command: CreateFulfillmentCommand,
) => Promise<Result<CreateFulfillmentUseCaseResult, CreateFulfillmentUseCaseError>>;

export function createCreateFulfillmentUseCase(deps: {
  uow: FulfillmentUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): CreateFulfillmentUseCase {
  return async function createFulfillmentUseCase(command) {
    return deps.uow.withTransaction(async ({ fulfillments, outbox }) => {
      const existingByKey = await fulfillments.findByIdempotencyKey(command.idempotencyKey);
      if (existingByKey !== null) {
        return ok({ fulfillment: existingByKey, idempotent: true });
      }

      const existingByOrder = await fulfillments.findByOrderId(command.orderId);
      if (existingByOrder !== null) {
        return err({
          type: "FulfillmentAlreadyExists",
          orderId: command.orderId,
          message: "A fulfillment already exists for this order",
        });
      }

      const created = createFulfillment({
        id: deps.generateId(),
        orderId: command.orderId,
        idempotencyKey: command.idempotencyKey,
        recipient: command.recipient,
        package: command.package,
        now: deps.now(),
      });

      if (!created.ok) {
        return err(created.error);
      }

      const events = [fulfillmentCreatedEvent(created.value)];
      await fulfillments.create(created.value, events);
      await outbox.saveAll(events);

      return ok({ fulfillment: created.value, idempotent: false });
    });
  };
}
