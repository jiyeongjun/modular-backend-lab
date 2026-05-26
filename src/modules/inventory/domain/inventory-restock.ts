export type InventoryRestock = Readonly<{
  id: string;
  sku: string;
  idempotencyKey: string;
  quantity: number;
  createdAt: Date;
}>;
