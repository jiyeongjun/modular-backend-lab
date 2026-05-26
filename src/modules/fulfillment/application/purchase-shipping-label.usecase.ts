import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type Fulfillment,
  type PurchaseShippingLabelError,
  purchaseShippingLabel,
} from "../domain/index.js";
import type {
  FulfillmentUnitOfWork,
  ShippingCarrier,
  ShippingCarrierError,
} from "../ports/index.js";

export type PurchaseShippingLabelCommand = Readonly<{
  fulfillmentId: string;
  idempotencyKey: string;
}>;

export type PurchaseShippingLabelUseCaseError =
  | PurchaseShippingLabelError
  | ShippingCarrierError
  | {
      type: "FulfillmentNotFound";
      fulfillmentId: string;
      message: string;
    }
  | {
      type: "FulfillmentLabelAlreadyPurchased";
      fulfillmentId: string;
      message: string;
    };

export type PurchaseShippingLabelUseCaseResult = Readonly<{
  fulfillment: Fulfillment;
  idempotent: boolean;
}>;

export type PurchaseShippingLabelUseCase = (
  command: PurchaseShippingLabelCommand,
) => Promise<Result<PurchaseShippingLabelUseCaseResult, PurchaseShippingLabelUseCaseError>>;

export function createPurchaseShippingLabelUseCase(deps: {
  uow: FulfillmentUnitOfWork;
  carrier: ShippingCarrier;
  now: () => Date;
}): PurchaseShippingLabelUseCase {
  return async function purchaseShippingLabelUseCase(command) {
    const existingByKey = await deps.uow.withTransaction(({ fulfillments }) =>
      fulfillments.findByLabelIdempotencyKey(command.idempotencyKey),
    );
    if (existingByKey !== null) {
      return ok({ fulfillment: existingByKey, idempotent: true });
    }

    const current = await deps.uow.withTransaction(({ fulfillments }) =>
      fulfillments.findById(command.fulfillmentId),
    );
    if (current === null) {
      return err({
        type: "FulfillmentNotFound",
        fulfillmentId: command.fulfillmentId,
        message: "Fulfillment was not found",
      });
    }

    if (hasPurchasedLabel(current)) {
      return err({
        type: "FulfillmentLabelAlreadyPurchased",
        fulfillmentId: current.id,
        message: "A shipping label already exists for this fulfillment",
      });
    }

    if (current.status !== "PACKED") {
      return err({
        type: "FulfillmentNotLabelable",
        status: current.status,
        message: "Only packed fulfillments can purchase shipping labels",
      });
    }

    const carrierLabel = await deps.carrier.purchaseLabel({
      fulfillmentId: current.id,
      orderId: current.orderId,
      idempotencyKey: command.idempotencyKey,
      recipient: current.recipient,
      package: current.package,
    });
    if (!carrierLabel.ok) {
      return err(carrierLabel.error);
    }

    return deps.uow.withTransaction(async ({ fulfillments, outbox }) => {
      const existingInsideTransaction = await fulfillments.findByLabelIdempotencyKey(
        command.idempotencyKey,
      );
      if (existingInsideTransaction !== null) {
        return ok({ fulfillment: existingInsideTransaction, idempotent: true });
      }

      const locked = await fulfillments.findByIdForUpdate(command.fulfillmentId);
      if (locked === null) {
        throw new Error(`Fulfillment ${command.fulfillmentId} disappeared during label purchase`);
      }

      if (hasPurchasedLabel(locked)) {
        return err({
          type: "FulfillmentLabelAlreadyPurchased",
          fulfillmentId: locked.id,
          message: "A shipping label already exists for this fulfillment",
        });
      }

      const labeled = purchaseShippingLabel(locked, {
        idempotencyKey: command.idempotencyKey,
        label: carrierLabel.value,
        now: deps.now(),
      });
      if (!labeled.ok) {
        return err(labeled.error);
      }

      await fulfillments.save(labeled.value.fulfillment);
      await outbox.saveAll(labeled.value.events);

      return ok({ fulfillment: labeled.value.fulfillment, idempotent: false });
    });
  };
}

function hasPurchasedLabel(fulfillment: Fulfillment): boolean {
  return (
    fulfillment.status === "LABEL_PURCHASED" ||
    fulfillment.status === "SHIPPED" ||
    fulfillment.status === "DELIVERED"
  );
}
