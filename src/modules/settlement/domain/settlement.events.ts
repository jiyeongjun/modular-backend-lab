import type { Money } from "../../../shared/money/index.js";

export type SettlementOpened = Readonly<{
  type: "SettlementOpened";
  aggregateType: "Settlement";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    settlementId: string;
    orderId: string;
    paymentId: string;
    grossAmount: Money;
    authorizedAt: Date;
  };
}>;

export type SettlementRefundsUpdated = Readonly<{
  type: "SettlementRefundsUpdated";
  aggregateType: "Settlement";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    settlementId: string;
    orderId: string;
    refundedAmount: Money;
    netAmount: Money;
  };
}>;

export type SettlementMarkedReady = Readonly<{
  type: "SettlementMarkedReady";
  aggregateType: "Settlement";
  aggregateId: string;
  occurredAt: Date;
  payload: {
    settlementId: string;
    orderId: string;
    deliveredAt: Date;
    readyAt: Date;
    netAmount: Money;
  };
}>;

export type SettlementEvent = SettlementOpened | SettlementRefundsUpdated | SettlementMarkedReady;
