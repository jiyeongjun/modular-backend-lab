import { err, ok, type Result } from "../../../shared/result/index.js";
import {
  type ApplyCarrierStatusError,
  applyCarrierShipmentStatus,
  type Fulfillment,
} from "../domain/index.js";
import type {
  FulfillmentReader,
  FulfillmentUnitOfWork,
  ShippingCarrier,
  ShippingCarrierError,
} from "../ports/index.js";

export type SyncFulfillmentCarrierStatusCommand = Readonly<{
  fulfillmentId: string;
}>;

export type SyncFulfillmentCarrierStatusUseCaseError =
  | ApplyCarrierStatusError
  | ShippingCarrierError
  | {
      type: "FulfillmentNotFound";
      fulfillmentId: string;
      message: string;
    };

export type SyncFulfillmentCarrierStatusUseCaseResult = Readonly<{
  fulfillment: Fulfillment;
  updated: boolean;
}>;

export type SyncFulfillmentCarrierStatusUseCase = (
  command: SyncFulfillmentCarrierStatusCommand,
) => Promise<
  Result<SyncFulfillmentCarrierStatusUseCaseResult, SyncFulfillmentCarrierStatusUseCaseError>
>;

export type SyncFulfillmentStatusesCommand = Readonly<{
  batchSize: number;
}>;

export type SyncFulfillmentStatusesResult = Readonly<{
  scanned: number;
  updated: number;
  failed: number;
}>;

export type SyncFulfillmentStatusesUseCase = (
  command: SyncFulfillmentStatusesCommand,
) => Promise<Result<SyncFulfillmentStatusesResult, never>>;

export function createSyncFulfillmentCarrierStatusUseCase(deps: {
  uow: FulfillmentUnitOfWork;
  carrier: ShippingCarrier;
  now: () => Date;
}): SyncFulfillmentCarrierStatusUseCase {
  return async function syncFulfillmentCarrierStatusUseCase(command) {
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

    if (current.status === "DELIVERED") {
      return ok({ fulfillment: current, updated: false });
    }

    if (current.status !== "LABEL_PURCHASED" && current.status !== "SHIPPED") {
      return err({
        type: "FulfillmentNotTrackable",
        status: current.status,
        message: "Fulfillment does not have a carrier shipment to track",
      });
    }

    const carrierStatus = await deps.carrier.getShipmentStatus({
      carrier: current.carrier,
      carrierShipmentId: current.carrierShipmentId,
      trackingNumber: current.trackingNumber,
    });
    if (!carrierStatus.ok) {
      return err(carrierStatus.error);
    }

    return deps.uow.withTransaction(async ({ fulfillments, outbox }) => {
      const locked = await fulfillments.findByIdForUpdate(command.fulfillmentId);
      if (locked === null) {
        throw new Error(`Fulfillment ${command.fulfillmentId} disappeared during status sync`);
      }

      const applied = applyCarrierShipmentStatus(locked, carrierStatus.value, deps.now());
      if (!applied.ok) {
        return err(applied.error);
      }

      if (applied.value.events.length === 0) {
        return ok({ fulfillment: applied.value.fulfillment, updated: false });
      }

      await fulfillments.save(applied.value.fulfillment, applied.value.events);
      await outbox.saveAll(applied.value.events);

      return ok({ fulfillment: applied.value.fulfillment, updated: true });
    });
  };
}

export function createSyncFulfillmentStatusesUseCase(deps: {
  reader: FulfillmentReader;
  syncOne: SyncFulfillmentCarrierStatusUseCase;
}): SyncFulfillmentStatusesUseCase {
  return async function syncFulfillmentStatusesUseCase(command) {
    let scanned = 0;
    let updated = 0;
    let failed = 0;

    for await (const fulfillment of deps.reader.iterateTrackable({
      batchSize: command.batchSize,
    })) {
      scanned += 1;
      const result = await deps.syncOne({ fulfillmentId: fulfillment.id });
      if (!result.ok) {
        failed += 1;
      } else if (result.value.updated) {
        updated += 1;
      }
    }

    return ok({ scanned, updated, failed });
  };
}
