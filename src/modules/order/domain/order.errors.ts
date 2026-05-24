export type PayOrderError =
  | { type: "OrderAlreadyPaid"; message: string }
  | { type: "OrderCancelled"; message: string }
  | { type: "InvalidOrderTotal"; message: string };
