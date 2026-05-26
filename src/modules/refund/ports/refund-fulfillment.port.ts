import type { Result } from "../../../shared/result/index.js";

export type RefundFulfillmentStatus =
  | "READY"
  | "PACKED"
  | "LABEL_PURCHASED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type RefundFulfillment = Readonly<{
  fulfillmentId: string;
  orderId: string;
  status: RefundFulfillmentStatus;
}>;

export type RefundFulfillmentError = Readonly<{
  type: "RefundFulfillmentLookupFailed";
  message: string;
}>;

export type RefundFulfillmentPort = {
  findByOrderId(orderId: string): Promise<Result<RefundFulfillment | null, RefundFulfillmentError>>;
};
