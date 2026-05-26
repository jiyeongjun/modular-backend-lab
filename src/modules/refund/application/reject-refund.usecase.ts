import { err, ok, type Result } from "../../../shared/result/index.js";
import { type Refund, type RejectRefundError, rejectRefund } from "../domain/index.js";
import type { RefundUnitOfWork } from "../ports/index.js";

export type RejectRefundCommand = Readonly<{
  refundId: string;
  reason: string;
}>;

export type RejectRefundUseCaseError =
  | RejectRefundError
  | {
      type: "RefundNotFound";
      refundId: string;
      message: string;
    };

export type RejectRefundUseCaseResult = Readonly<{
  refund: Refund;
  idempotent: boolean;
}>;

export type RejectRefundUseCase = (
  command: RejectRefundCommand,
) => Promise<Result<RejectRefundUseCaseResult, RejectRefundUseCaseError>>;

export function createRejectRefundUseCase(deps: {
  uow: RefundUnitOfWork;
  now: () => Date;
}): RejectRefundUseCase {
  return async function rejectRefundUseCase(command) {
    return deps.uow.withTransaction(async ({ refunds, outbox }) => {
      const refund = await refunds.findByIdForUpdate(command.refundId);
      if (refund === null) {
        return err({
          type: "RefundNotFound",
          refundId: command.refundId,
          message: "Refund was not found",
        });
      }

      if (refund.status === "REJECTED") {
        return ok({ refund, idempotent: true });
      }

      const rejected = rejectRefund(refund, {
        reason: command.reason,
        now: deps.now(),
      });
      if (!rejected.ok) {
        return err(rejected.error);
      }

      await refunds.save(rejected.value.refund, rejected.value.events);
      await outbox.saveAll(rejected.value.events);

      return ok({ refund: rejected.value.refund, idempotent: false });
    });
  };
}
