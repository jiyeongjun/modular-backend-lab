import type { Result } from "../../../shared/result/index.js";

export type RefundInventoryRestockCommand = Readonly<{
  sku: string;
  quantity: number;
  idempotencyKey: string;
}>;

export type RefundInventoryRestock = Readonly<{
  sku: string;
  quantity: number;
}>;

export type RefundInventoryError =
  | {
      type: "RefundInventoryItemNotFound";
      sku: string;
      message: string;
    }
  | {
      type: "RefundInvalidInventoryRestock";
      message: string;
    };

export type RefundInventoryPort = {
  restock(
    command: RefundInventoryRestockCommand,
  ): Promise<Result<RefundInventoryRestock, RefundInventoryError>>;
};
