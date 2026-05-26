import { type Kysely, sql, type Transaction } from "kysely";
import type { Database, DomainEventRow } from "../../../infra/db/database.js";
import type { Currency, Money } from "../../../shared/money/index.js";
import type {
  SettlementSourceFacts,
  SettlementSourceFulfillment,
  SettlementSourcePayment,
  SettlementSourceRefund,
} from "../domain/index.js";
import type { SettlementSourceReader } from "../ports/index.js";

type DbExecutor = Kysely<Database> | Transaction<Database>;

const sourceEventTypes = [
  "PaymentAuthorized",
  "RefundPaymentRefunded",
  "FulfillmentDelivered",
] as const;

type SourceEventType = (typeof sourceEventTypes)[number];

export function createKyselySettlementSourceReader(db: DbExecutor): SettlementSourceReader {
  return {
    async findFactsByOrderId(orderId) {
      const rows = await db
        .selectFrom("domain_events")
        .select(["id", "event_type", "payload", "occurred_at"])
        .where("event_type", "in", sourceEventTypes)
        .where(sql<string>`payload ->> 'orderId'`, "=", orderId)
        .orderBy("occurred_at", "asc")
        .orderBy("id", "asc")
        .execute();

      return toSettlementSourceFacts(orderId, rows);
    },

    async *iterateCandidateOrderIds(options) {
      if (options.batchSize < 1) {
        throw new Error("batchSize must be greater than zero");
      }

      const rows = await sql<{ order_id: string }>`
        select de.payload ->> 'orderId' as order_id
        from domain_events de
        left join settlements s on s.order_id = de.payload ->> 'orderId'
        where de.event_type in (${sql.join(sourceEventTypes)})
          and de.payload ->> 'orderId' is not null
          and (s.order_id is null or de.occurred_at > s.updated_at)
        group by de.payload ->> 'orderId'
        order by max(de.occurred_at) asc, de.payload ->> 'orderId' asc
        limit ${options.batchSize}
      `.execute(db);

      for (const row of rows.rows) {
        if (row.order_id.length > 0) {
          yield row.order_id;
        }
      }
    },
  };
}

function toSettlementSourceFacts(
  orderId: string,
  rows: readonly Pick<DomainEventRow, "id" | "event_type" | "payload" | "occurred_at">[],
): SettlementSourceFacts {
  let payment: SettlementSourcePayment | null = null;
  const refunds: SettlementSourceRefund[] = [];
  let fulfillment: SettlementSourceFulfillment | null = null;

  for (const row of rows) {
    const eventType = toSourceEventType(row.event_type);
    if (eventType === null) {
      continue;
    }

    switch (eventType) {
      case "PaymentAuthorized": {
        const nextPayment = parsePaymentAuthorized(row.payload);
        if (nextPayment !== null) {
          payment = choosePayment(payment, nextPayment, row.id);
        }
        break;
      }

      case "RefundPaymentRefunded": {
        const refund = parseRefundPaymentRefunded(row.payload);
        if (refund !== null) {
          refunds.push(refund);
        }
        break;
      }

      case "FulfillmentDelivered": {
        const delivered = parseFulfillmentDelivered(row.payload);
        if (delivered !== null) {
          fulfillment = chooseFulfillment(fulfillment, delivered);
        }
        break;
      }
    }
  }

  return {
    orderId,
    payment,
    refunds,
    fulfillment,
  };
}

function toSourceEventType(value: string): SourceEventType | null {
  if (
    value === "PaymentAuthorized" ||
    value === "RefundPaymentRefunded" ||
    value === "FulfillmentDelivered"
  ) {
    return value;
  }
  return null;
}

function choosePayment(
  current: SettlementSourcePayment | null,
  next: SettlementSourcePayment,
  rowId: string,
): SettlementSourcePayment {
  if (current === null) {
    return next;
  }

  if (
    current.paymentId !== next.paymentId ||
    current.amount.amount !== next.amount.amount ||
    current.amount.currency !== next.amount.currency
  ) {
    throw new Error(`Conflicting PaymentAuthorized event in settlement source: ${rowId}`);
  }

  return current.authorizedAt <= next.authorizedAt ? current : next;
}

function chooseFulfillment(
  current: SettlementSourceFulfillment | null,
  next: SettlementSourceFulfillment,
): SettlementSourceFulfillment {
  if (current === null) {
    return next;
  }

  return current.deliveredAt <= next.deliveredAt ? current : next;
}

function parsePaymentAuthorized(payload: unknown): SettlementSourcePayment | null {
  if (!isRecord(payload)) {
    return null;
  }

  const paymentId = getString(payload, "paymentId");
  const amount = getMoney(payload, "amount");
  const authorizedAt = getDate(payload, "authorizedAt");
  if (paymentId === null || amount === null || authorizedAt === null) {
    return null;
  }

  return { paymentId, amount, authorizedAt };
}

function parseRefundPaymentRefunded(payload: unknown): SettlementSourceRefund | null {
  if (!isRecord(payload)) {
    return null;
  }

  const refundId = getString(payload, "refundId");
  const paymentId = getString(payload, "paymentId");
  const amount = getMoney(payload, "amount");
  const refundedAt = getDate(payload, "paymentRefundedAt");
  if (refundId === null || paymentId === null || amount === null || refundedAt === null) {
    return null;
  }

  return { refundId, paymentId, amount, refundedAt };
}

function parseFulfillmentDelivered(payload: unknown): SettlementSourceFulfillment | null {
  if (!isRecord(payload)) {
    return null;
  }

  const fulfillmentId = getString(payload, "fulfillmentId");
  const deliveredAt = getDate(payload, "deliveredAt");
  if (fulfillmentId === null || deliveredAt === null) {
    return null;
  }

  return { fulfillmentId, deliveredAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getMoney(record: Record<string, unknown>, key: string): Money | null {
  const value = record[key];
  if (!isRecord(value)) {
    return null;
  }

  const amount = value.amount;
  const currency = value.currency;
  if (typeof amount !== "number" || !isCurrency(currency)) {
    return null;
  }

  return { amount, currency };
}

function isCurrency(value: unknown): value is Currency {
  return value === "KRW" || value === "USD";
}

function getDate(record: Record<string, unknown>, key: string): Date | null {
  const value = record[key];
  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
