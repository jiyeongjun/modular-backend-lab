import type { Money } from "../../../shared/money/index.js";

export type SyncSettlementError =
  | {
      type: "SettlementSourcePaymentMissing";
      orderId: string;
      message: string;
    }
  | {
      type: "InvalidSettlementAmount";
      amount: Money;
      message: string;
    }
  | {
      type: "SettlementCurrencyMismatch";
      orderId: string;
      expectedCurrency: Money["currency"];
      actualCurrency: Money["currency"];
      message: string;
    }
  | {
      type: "SettlementRefundExceedsGross";
      orderId: string;
      grossAmount: Money;
      refundedAmount: Money;
      message: string;
    }
  | {
      type: "SettlementPaymentMismatch";
      orderId: string;
      expectedPaymentId: string;
      actualPaymentId: string;
      message: string;
    }
  | {
      type: "SettlementRefundTotalDecreased";
      orderId: string;
      currentRefundedAmount: Money;
      sourceRefundedAmount: Money;
      message: string;
    };
