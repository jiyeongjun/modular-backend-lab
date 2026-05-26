import type { Money } from "../../../shared/money/index.js";
import type { PaymentStatus } from "./payment.js";

export type StartPaymentError = {
  type: "InvalidPaymentAmount";
  amount: Money;
  message: string;
};

export type AuthorizePaymentError =
  | {
      type: "PaymentNotConfirmable";
      status: PaymentStatus;
      message: string;
    }
  | {
      type: "PaymentAuthorizationMismatch";
      field: "paymentKey" | "orderId" | "amount" | "currency";
      message: string;
    };

export type FailPaymentError = {
  type: "PaymentNotFailable";
  status: PaymentStatus;
  message: string;
};

export type CancelPaymentError = {
  type: "PaymentNotCancellable";
  status: PaymentStatus;
  message: string;
};
