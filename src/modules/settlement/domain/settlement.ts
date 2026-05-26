import type { Money } from "../../../shared/money/index.js";

export type SettlementStatus = "OPEN" | "READY";

export type SettlementBase = Readonly<{
  id: string;
  orderId: string;
  paymentId: string;
  grossAmount: Money;
  refundedAmount: Money;
  netAmount: Money;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type OpenSettlement = SettlementBase &
  Readonly<{
    status: "OPEN";
    deliveredAt: null;
    readyAt: null;
  }>;

export type ReadySettlement = SettlementBase &
  Readonly<{
    status: "READY";
    deliveredAt: Date;
    readyAt: Date;
  }>;

export type Settlement = OpenSettlement | ReadySettlement;

export type SettlementSourcePayment = Readonly<{
  paymentId: string;
  amount: Money;
  authorizedAt: Date;
}>;

export type SettlementSourceRefund = Readonly<{
  refundId: string;
  paymentId: string;
  amount: Money;
  refundedAt: Date;
}>;

export type SettlementSourceFulfillment = Readonly<{
  fulfillmentId: string;
  deliveredAt: Date;
}>;

export type SettlementSourceFacts = Readonly<{
  orderId: string;
  payment: SettlementSourcePayment | null;
  refunds: readonly SettlementSourceRefund[];
  fulfillment: SettlementSourceFulfillment | null;
}>;
