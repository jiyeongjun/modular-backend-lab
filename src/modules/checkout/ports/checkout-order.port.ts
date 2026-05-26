import type { Money } from "../../../shared/money/index.js";
import type { Result } from "../../../shared/result/index.js";

export type CheckoutOrder = Readonly<{
  orderId: string;
  amount: Money;
}>;

export type PaidCheckoutOrder = Readonly<{
  orderId: string;
  status: "PAID";
  idempotent: boolean;
}>;

export type CheckoutOrderError =
  | { type: "CheckoutOrderNotFound"; orderId: string; message: string }
  | { type: "CheckoutOrderNotPayable"; status: string; message: string }
  | { type: "CheckoutOrderAmountMismatch"; expected: Money; actual: Money; message: string }
  | { type: "CheckoutOrderPaymentRejected"; reason: string; message: string };

export type ValidateCheckoutOrderCommand = Readonly<{
  orderId: string;
  amount: Money;
}>;

export type MarkCheckoutOrderPaidCommand = Readonly<{
  orderId: string;
}>;

export type CheckoutOrderPort = {
  validateForCheckout(
    command: ValidateCheckoutOrderCommand,
  ): Promise<Result<CheckoutOrder, CheckoutOrderError>>;
  markPaid(
    command: MarkCheckoutOrderPaidCommand,
  ): Promise<Result<PaidCheckoutOrder, CheckoutOrderError>>;
};
