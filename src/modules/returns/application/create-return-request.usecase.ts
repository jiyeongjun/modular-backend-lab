import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type CreateReturnRequestError,
  createReturnRequest,
  type ReturnItem,
  type ReturnRequest,
  returnRequestedEvent,
} from "../domain/index.js";
import type { ReturnsUnitOfWork } from "../ports/index.js";

export type CreateReturnRequestCommand = Readonly<{
  orderId: string;
  fulfillmentId: string;
  idempotencyKey: string;
  reason: string;
  items: readonly ReturnItem[];
}>;

export type CreateReturnRequestUseCaseError =
  | CreateReturnRequestError
  | {
      type: "ReturnRequestIdempotencyConflict";
      idempotencyKey: string;
      message: string;
    };

export type CreateReturnRequestUseCaseResult = Readonly<{
  returnRequest: ReturnRequest;
  idempotent: boolean;
}>;

export type CreateReturnRequestUseCase = (
  command: CreateReturnRequestCommand,
) => Promise<Result<CreateReturnRequestUseCaseResult, CreateReturnRequestUseCaseError>>;

export function createCreateReturnRequestUseCase(deps: {
  uow: ReturnsUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): CreateReturnRequestUseCase {
  return async function createReturnRequestUseCase(command) {
    return deps.uow.withTransaction<
      CreateReturnRequestUseCaseResult,
      CreateReturnRequestUseCaseError
    >(async ({ returns, outbox }) => {
      const existing = await returns.findByIdempotencyKey(command.idempotencyKey);
      if (existing !== null) {
        if (
          existing.orderId !== command.orderId ||
          existing.fulfillmentId !== command.fulfillmentId
        ) {
          return err({
            type: "ReturnRequestIdempotencyConflict",
            idempotencyKey: command.idempotencyKey,
            message: "Return request idempotency key belongs to another command",
          });
        }

        return ok({ returnRequest: existing, idempotent: true });
      }

      const created = createReturnRequest({
        id: deps.generateId(),
        orderId: command.orderId,
        fulfillmentId: command.fulfillmentId,
        idempotencyKey: command.idempotencyKey,
        reason: command.reason,
        items: command.items,
        now: deps.now(),
      });

      if (!created.ok) {
        return err(created.error);
      }

      const events = [returnRequestedEvent(created.value)];
      await returns.create(created.value, events);
      await outbox.saveAll(events);

      return ok({ returnRequest: created.value, idempotent: false });
    });
  };
}
