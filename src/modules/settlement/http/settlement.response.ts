import type { Result } from "../../../shared/result/index.js";
import type {
  GetSettlementUseCaseError,
  SyncSettlementUseCaseError,
  SyncSettlementUseCaseResult,
} from "../application/index.js";
import type { Settlement } from "../domain/index.js";

export type SettlementHttpResponseShape = Readonly<{
  status: 200 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeSettlement(settlement: Settlement): Record<string, unknown> {
  return {
    id: settlement.id,
    orderId: settlement.orderId,
    paymentId: settlement.paymentId,
    status: settlement.status,
    grossAmount: settlement.grossAmount,
    refundedAmount: settlement.refundedAmount,
    netAmount: settlement.netAmount,
    deliveredAt: settlement.deliveredAt?.toISOString() ?? null,
    readyAt: settlement.readyAt?.toISOString() ?? null,
    version: settlement.version,
    createdAt: settlement.createdAt.toISOString(),
    updatedAt: settlement.updatedAt.toISOString(),
  };
}

export function mapSyncSettlementResult(
  result: Result<SyncSettlementUseCaseResult, SyncSettlementUseCaseError>,
): SettlementHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeSettlement(result.value.settlement),
        updated: result.value.updated,
      },
    };
  }

  return mapSyncSettlementError(result.error);
}

export function mapGetSettlementResult(
  result: Result<Settlement, GetSettlementUseCaseError>,
): SettlementHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: { data: serializeSettlement(result.value) },
    };
  }

  return {
    status: 404,
    body: { error: result.error },
  };
}

function mapSyncSettlementError(error: SyncSettlementUseCaseError): SettlementHttpResponseShape {
  switch (error.type) {
    case "InvalidSettlementAmount":
      return {
        status: 400,
        body: { error },
      };

    case "SettlementCurrencyMismatch":
    case "SettlementPaymentMismatch":
    case "SettlementRefundExceedsGross":
    case "SettlementRefundTotalDecreased":
    case "SettlementSourcePaymentMissing":
      return {
        status: 409,
        body: { error },
      };
  }
}
