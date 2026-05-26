export type InventoryItem = Readonly<{
  sku: string;
  onHand: number;
  reserved: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function getAvailableQuantity(item: InventoryItem): number {
  return item.onHand - item.reserved;
}
