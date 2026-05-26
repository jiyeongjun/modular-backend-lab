import { err, ok, type Result } from "../../../shared/result/index.js";
import { type RestockInventoryError, restockInventory } from "../domain/index.js";
import type { InventoryUnitOfWork } from "../ports/index.js";

export type RestockInventoryCommand = Readonly<{
  sku: string;
  quantity: number;
  idempotencyKey: string;
}>;

export type RestockInventoryUseCaseError =
  | {
      type: "InventoryItemNotFound";
      sku: string;
      message: string;
    }
  | RestockInventoryError;

export type RestockInventoryUseCaseResult = Readonly<{
  sku: string;
  quantity: number;
  idempotent: boolean;
}>;

export type RestockInventoryUseCase = (
  command: RestockInventoryCommand,
) => Promise<Result<RestockInventoryUseCaseResult, RestockInventoryUseCaseError>>;

export function createRestockInventoryUseCase(deps: {
  uow: InventoryUnitOfWork;
  now: () => Date;
  generateId: () => string;
}): RestockInventoryUseCase {
  return async function restockInventoryUseCase(command) {
    return deps.uow.withTransaction(async ({ items, restocks, outbox }) => {
      const existing = await restocks.findByIdempotencyKey(command.idempotencyKey);
      if (existing !== null) {
        return ok({
          sku: existing.sku,
          quantity: existing.quantity,
          idempotent: true,
        });
      }

      const item = await items.findBySkuForUpdate(command.sku);
      if (item === null) {
        return err({
          type: "InventoryItemNotFound",
          sku: command.sku,
          message: "Inventory item was not found",
        });
      }

      const now = deps.now();
      const restocked = restockInventory(item, {
        quantity: command.quantity,
        now,
      });
      if (!restocked.ok) {
        return err(restocked.error);
      }

      await items.save(restocked.value.item, restocked.value.events);
      await restocks.create({
        id: deps.generateId(),
        sku: command.sku,
        idempotencyKey: command.idempotencyKey,
        quantity: command.quantity,
        createdAt: now,
      });
      await outbox.saveAll(restocked.value.events);

      return ok({
        sku: command.sku,
        quantity: command.quantity,
        idempotent: false,
      });
    });
  };
}
