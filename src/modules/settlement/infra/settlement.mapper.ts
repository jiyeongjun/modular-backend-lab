import type {
  SettlementInsert,
  SettlementRow,
  SettlementUpdate,
} from "../../../infra/db/database.js";
import type { Currency } from "../../../shared/money/index.js";
import type {
  OpenSettlement,
  ReadySettlement,
  Settlement,
  SettlementStatus,
} from "../domain/index.js";

function toSettlementStatus(value: string): SettlementStatus {
  if (value === "OPEN" || value === "READY") {
    return value;
  }
  throw new Error(`Unknown settlement status: ${value}`);
}

function toCurrency(value: string): Currency {
  if (value === "KRW" || value === "USD") {
    return value;
  }
  throw new Error(`Unknown settlement currency: ${value}`);
}

function base(row: SettlementRow) {
  if (row.gross_amount <= 0) {
    throw new Error(`Settlement ${row.id} has invalid gross amount`);
  }
  if (row.refunded_amount < 0 || row.net_amount < 0) {
    throw new Error(`Settlement ${row.id} has invalid derived amounts`);
  }
  if (row.gross_amount - row.refunded_amount !== row.net_amount) {
    throw new Error(`Settlement ${row.id} has inconsistent amounts`);
  }

  const currency = toCurrency(row.currency);
  return {
    id: row.id,
    orderId: row.order_id,
    paymentId: row.payment_id,
    grossAmount: { amount: row.gross_amount, currency },
    refundedAmount: { amount: row.refunded_amount, currency },
    netAmount: { amount: row.net_amount, currency },
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSettlement(row: SettlementRow): Settlement {
  switch (toSettlementStatus(row.status)) {
    case "OPEN": {
      if (row.delivered_at !== null || row.ready_at !== null) {
        throw new Error(`Open settlement ${row.id} has ready timestamps`);
      }
      const settlement: OpenSettlement = {
        ...base(row),
        status: "OPEN",
        deliveredAt: null,
        readyAt: null,
      };
      return settlement;
    }

    case "READY": {
      if (row.delivered_at === null || row.ready_at === null) {
        throw new Error(`Ready settlement ${row.id} is missing ready timestamps`);
      }
      const settlement: ReadySettlement = {
        ...base(row),
        status: "READY",
        deliveredAt: row.delivered_at,
        readyAt: row.ready_at,
      };
      return settlement;
    }
  }
}

export function toSettlementInsert(settlement: Settlement, version: number): SettlementInsert {
  return {
    id: settlement.id,
    order_id: settlement.orderId,
    payment_id: settlement.paymentId,
    status: settlement.status,
    gross_amount: settlement.grossAmount.amount,
    refunded_amount: settlement.refundedAmount.amount,
    net_amount: settlement.netAmount.amount,
    currency: settlement.grossAmount.currency,
    delivered_at: settlement.deliveredAt,
    ready_at: settlement.readyAt,
    version,
    created_at: settlement.createdAt,
    updated_at: settlement.updatedAt,
  };
}

export function toSettlementUpdate(settlement: Settlement): SettlementUpdate {
  return {
    status: settlement.status,
    refunded_amount: settlement.refundedAmount.amount,
    net_amount: settlement.netAmount.amount,
    delivered_at: settlement.deliveredAt,
    ready_at: settlement.readyAt,
    updated_at: settlement.updatedAt,
  };
}
