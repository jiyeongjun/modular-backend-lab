import { isPositiveMoney, type Money } from "../../../shared/money/index.js";
import { err, ok, type Result } from "../../../shared/result/index.js";
import type { SyncSettlementError } from "./settlement.errors.js";
import type { SettlementEvent } from "./settlement.events.js";
import type {
  OpenSettlement,
  ReadySettlement,
  Settlement,
  SettlementSourceFacts,
  SettlementSourceRefund,
} from "./settlement.js";

export type SyncSettlementInput = Readonly<{
  id: string;
  existing: Settlement | null;
  facts: SettlementSourceFacts;
  now: Date;
}>;

export type SettlementTransition = Readonly<{
  settlement: Settlement;
  events: readonly SettlementEvent[];
}>;

export function syncSettlement(
  input: SyncSettlementInput,
): Result<SettlementTransition, SyncSettlementError> {
  if (input.facts.payment === null) {
    return err({
      type: "SettlementSourcePaymentMissing",
      orderId: input.facts.orderId,
      message: "Settlement requires an authorized payment source event",
    });
  }
  const payment = input.facts.payment;

  if (!isPositiveMoney(payment.amount)) {
    return err({
      type: "InvalidSettlementAmount",
      amount: payment.amount,
      message: "Settlement gross amount must be positive",
    });
  }

  const refunded = totalRefundedAmount(input.facts.orderId, payment.amount, input.facts.refunds);
  if (!refunded.ok) {
    return refunded;
  }

  if (refunded.value.amount > payment.amount.amount) {
    return err({
      type: "SettlementRefundExceedsGross",
      orderId: input.facts.orderId,
      grossAmount: payment.amount,
      refundedAmount: refunded.value,
      message: "Refunded amount cannot exceed gross payment amount",
    });
  }

  const netAmount = subtractMoney(payment.amount, refunded.value);

  if (input.existing === null) {
    return ok(createNewSettlement(input, payment, refunded.value, netAmount));
  }

  const paymentMismatch = findPaymentMismatch(input.existing, payment.paymentId);
  if (paymentMismatch !== null) {
    return err(paymentMismatch);
  }

  if (refunded.value.amount < input.existing.refundedAmount.amount) {
    return err({
      type: "SettlementRefundTotalDecreased",
      orderId: input.facts.orderId,
      currentRefundedAmount: input.existing.refundedAmount,
      sourceRefundedAmount: refunded.value,
      message: "Settlement source refunded amount must not decrease",
    });
  }

  let current = input.existing;
  const events: SettlementEvent[] = [];

  if (refunded.value.amount > current.refundedAmount.amount) {
    current = {
      ...current,
      refundedAmount: refunded.value,
      netAmount,
      updatedAt: input.now,
    };
    events.push(refundsUpdatedEvent(current, input.now));
  }

  if (input.facts.fulfillment !== null && current.status === "OPEN") {
    current = markReady(current, input.facts.fulfillment.deliveredAt, input.now);
    events.push(markedReadyEvent(current, input.now));
  }

  return ok({
    settlement: current,
    events,
  });
}

function createNewSettlement(
  input: SyncSettlementInput,
  payment: NonNullable<SettlementSourceFacts["payment"]>,
  refundedAmount: Money,
  netAmount: Money,
): SettlementTransition {
  const opened: OpenSettlement = {
    id: input.id,
    orderId: input.facts.orderId,
    paymentId: payment.paymentId,
    status: "OPEN",
    grossAmount: payment.amount,
    refundedAmount,
    netAmount,
    deliveredAt: null,
    readyAt: null,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  };
  const events: SettlementEvent[] = [openedEvent(opened, payment.authorizedAt, input.now)];

  if (input.facts.fulfillment === null) {
    return { settlement: opened, events };
  }

  const ready = markReady(opened, input.facts.fulfillment.deliveredAt, input.now);
  events.push(markedReadyEvent(ready, input.now));
  return { settlement: ready, events };
}

function totalRefundedAmount(
  orderId: string,
  grossAmount: Money,
  refunds: readonly SettlementSourceRefund[],
): Result<Money, SyncSettlementError> {
  let amount = 0;

  for (const refund of refunds) {
    if (refund.amount.currency !== grossAmount.currency) {
      return err({
        type: "SettlementCurrencyMismatch",
        orderId,
        expectedCurrency: grossAmount.currency,
        actualCurrency: refund.amount.currency,
        message: "Refund currency must match settlement currency",
      });
    }

    amount += refund.amount.amount;
  }

  return ok({
    amount,
    currency: grossAmount.currency,
  });
}

function subtractMoney(grossAmount: Money, refundedAmount: Money): Money {
  return {
    amount: grossAmount.amount - refundedAmount.amount,
    currency: grossAmount.currency,
  };
}

function findPaymentMismatch(
  settlement: Settlement,
  sourcePaymentId: string,
): SyncSettlementError | null {
  if (settlement.paymentId !== sourcePaymentId) {
    return {
      type: "SettlementPaymentMismatch",
      orderId: settlement.orderId,
      expectedPaymentId: settlement.paymentId,
      actualPaymentId: sourcePaymentId,
      message: "Settlement source payment changed for the same order",
    };
  }

  return null;
}

function markReady(settlement: OpenSettlement, deliveredAt: Date, now: Date): ReadySettlement {
  return {
    ...settlement,
    status: "READY",
    deliveredAt,
    readyAt: now,
    updatedAt: now,
  };
}

function openedEvent(
  settlement: OpenSettlement,
  authorizedAt: Date,
  occurredAt: Date,
): SettlementEvent {
  return {
    type: "SettlementOpened",
    aggregateType: "Settlement",
    aggregateId: settlement.id,
    occurredAt,
    payload: {
      settlementId: settlement.id,
      orderId: settlement.orderId,
      paymentId: settlement.paymentId,
      grossAmount: settlement.grossAmount,
      authorizedAt,
    },
  };
}

function refundsUpdatedEvent(settlement: Settlement, occurredAt: Date): SettlementEvent {
  return {
    type: "SettlementRefundsUpdated",
    aggregateType: "Settlement",
    aggregateId: settlement.id,
    occurredAt,
    payload: {
      settlementId: settlement.id,
      orderId: settlement.orderId,
      refundedAmount: settlement.refundedAmount,
      netAmount: settlement.netAmount,
    },
  };
}

function markedReadyEvent(settlement: ReadySettlement, occurredAt: Date): SettlementEvent {
  return {
    type: "SettlementMarkedReady",
    aggregateType: "Settlement",
    aggregateId: settlement.id,
    occurredAt,
    payload: {
      settlementId: settlement.id,
      orderId: settlement.orderId,
      deliveredAt: settlement.deliveredAt,
      readyAt: settlement.readyAt,
      netAmount: settlement.netAmount,
    },
  };
}
