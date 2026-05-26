import type { RefundStatus } from "./refund.js";

export type CreateRefundError =
  | {
      type: "InvalidRefundAmount";
      message: string;
    }
  | {
      type: "InvalidRefundInput";
      field: "id" | "orderId" | "paymentId" | "idempotencyKey" | "reason";
      message: string;
    }
  | {
      type: "RefundRestockRequired";
      message: string;
    }
  | {
      type: "RefundRestockNotAllowed";
      message: string;
    };

export type ApproveRefundError = {
  type: "RefundNotApprovable";
  status: Exclude<RefundStatus, "REQUESTED" | "APPROVED">;
  message: string;
};

export type RejectRefundError = {
  type: "RefundNotRejectable";
  status: Exclude<RefundStatus, "REQUESTED" | "REJECTED">;
  message: string;
};

export type MarkPaymentRefundedError = {
  type: "RefundPaymentNotRecordable";
  status: Exclude<RefundStatus, "APPROVED" | "PAYMENT_REFUNDED" | "RESTOCKED" | "COMPLETED">;
  message: string;
};

export type MarkRestockedError =
  | {
      type: "RefundRestockNotRequired";
      message: string;
    }
  | {
      type: "RefundRestockNotRecordable";
      status: Exclude<RefundStatus, "PAYMENT_REFUNDED" | "RESTOCKED" | "COMPLETED">;
      message: string;
    };

export type CompleteRefundError = {
  type: "RefundNotCompletable";
  status: Exclude<RefundStatus, "RESTOCKED" | "COMPLETED">;
  message: string;
};
