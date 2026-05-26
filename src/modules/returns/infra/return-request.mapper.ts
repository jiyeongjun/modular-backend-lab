import type {
  ReturnRequestInsert,
  ReturnRequestRow,
  ReturnRequestUpdate,
} from "../../../infra/db/database.js";
import type {
  ApprovedReturnRequest,
  AuthorizedReturnRequest,
  ReceivedReturnRequest,
  RejectedReturnRequest,
  RequestedReturnRequest,
  ReturnItem,
  ReturnRequest,
  ReturnStatus,
} from "../domain/index.js";

function toReturnStatus(value: string): ReturnStatus {
  if (
    value === "REQUESTED" ||
    value === "AUTHORIZED" ||
    value === "RECEIVED" ||
    value === "APPROVED" ||
    value === "REJECTED"
  ) {
    return value;
  }
  throw new Error(`Unknown return request status: ${value}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toReturnItems(value: unknown, columnName: string): readonly ReturnItem[] {
  if (!Array.isArray(value)) {
    throw new Error(`${columnName} must be an array`);
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(`${columnName} entries must be objects`);
    }

    const sku = entry.sku;
    const quantity = entry.quantity;
    if (typeof sku !== "string" || typeof quantity !== "number") {
      throw new Error(`${columnName} entries must include sku and quantity`);
    }

    return { sku, quantity };
  });
}

function base(row: ReturnRequestRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    fulfillmentId: row.fulfillment_id,
    idempotencyKey: row.idempotency_key,
    reason: row.reason,
    items: toReturnItems(row.items, "items"),
    requestedAt: row.requested_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toReturnRequest(row: ReturnRequestRow): ReturnRequest {
  switch (toReturnStatus(row.status)) {
    case "REQUESTED": {
      if (
        row.rma_number !== null ||
        row.authorized_at !== null ||
        row.received_at !== null ||
        row.inspected_at !== null ||
        row.restockable_items !== null ||
        row.inspection_note !== null ||
        row.rejection_reason !== null
      ) {
        throw new Error(`Requested return ${row.id} has non-requested columns`);
      }
      const returnRequest: RequestedReturnRequest = {
        ...base(row),
        status: "REQUESTED",
        rmaNumber: null,
        authorizedAt: null,
        receivedAt: null,
        inspectedAt: null,
        restockableItems: null,
        inspectionNote: null,
        rejectionReason: null,
      };
      return returnRequest;
    }

    case "AUTHORIZED": {
      if (
        row.rma_number === null ||
        row.authorized_at === null ||
        row.received_at !== null ||
        row.inspected_at !== null ||
        row.restockable_items !== null ||
        row.inspection_note !== null ||
        row.rejection_reason !== null
      ) {
        throw new Error(`Authorized return ${row.id} has invalid columns`);
      }
      const returnRequest: AuthorizedReturnRequest = {
        ...base(row),
        status: "AUTHORIZED",
        rmaNumber: row.rma_number,
        authorizedAt: row.authorized_at,
        receivedAt: null,
        inspectedAt: null,
        restockableItems: null,
        inspectionNote: null,
        rejectionReason: null,
      };
      return returnRequest;
    }

    case "RECEIVED": {
      if (
        row.rma_number === null ||
        row.authorized_at === null ||
        row.received_at === null ||
        row.inspected_at !== null ||
        row.restockable_items !== null ||
        row.inspection_note !== null ||
        row.rejection_reason !== null
      ) {
        throw new Error(`Received return ${row.id} has invalid columns`);
      }
      const returnRequest: ReceivedReturnRequest = {
        ...base(row),
        status: "RECEIVED",
        rmaNumber: row.rma_number,
        authorizedAt: row.authorized_at,
        receivedAt: row.received_at,
        inspectedAt: null,
        restockableItems: null,
        inspectionNote: null,
        rejectionReason: null,
      };
      return returnRequest;
    }

    case "APPROVED": {
      if (
        row.rma_number === null ||
        row.authorized_at === null ||
        row.received_at === null ||
        row.inspected_at === null ||
        row.restockable_items === null ||
        row.rejection_reason !== null
      ) {
        throw new Error(`Approved return ${row.id} has invalid columns`);
      }
      const returnRequest: ApprovedReturnRequest = {
        ...base(row),
        status: "APPROVED",
        rmaNumber: row.rma_number,
        authorizedAt: row.authorized_at,
        receivedAt: row.received_at,
        inspectedAt: row.inspected_at,
        restockableItems: toReturnItems(row.restockable_items, "restockable_items"),
        inspectionNote: row.inspection_note,
        rejectionReason: null,
      };
      return returnRequest;
    }

    case "REJECTED": {
      if (
        row.rma_number === null ||
        row.authorized_at === null ||
        row.received_at === null ||
        row.inspected_at === null ||
        row.restockable_items !== null ||
        row.rejection_reason === null
      ) {
        throw new Error(`Rejected return ${row.id} has invalid columns`);
      }
      const returnRequest: RejectedReturnRequest = {
        ...base(row),
        status: "REJECTED",
        rmaNumber: row.rma_number,
        authorizedAt: row.authorized_at,
        receivedAt: row.received_at,
        inspectedAt: row.inspected_at,
        restockableItems: null,
        inspectionNote: row.inspection_note,
        rejectionReason: row.rejection_reason,
      };
      return returnRequest;
    }
  }
}

export function toReturnRequestInsert(returnRequest: ReturnRequest): ReturnRequestInsert {
  return {
    id: returnRequest.id,
    order_id: returnRequest.orderId,
    fulfillment_id: returnRequest.fulfillmentId,
    idempotency_key: returnRequest.idempotencyKey,
    status: returnRequest.status,
    rma_number: returnRequest.rmaNumber,
    reason: returnRequest.reason,
    items: JSON.stringify(returnRequest.items),
    restockable_items:
      returnRequest.restockableItems === null
        ? null
        : JSON.stringify(returnRequest.restockableItems),
    inspection_note: returnRequest.inspectionNote,
    rejection_reason: returnRequest.rejectionReason,
    requested_at: returnRequest.requestedAt,
    authorized_at: returnRequest.authorizedAt,
    received_at: returnRequest.receivedAt,
    inspected_at: returnRequest.inspectedAt,
    version: returnRequest.version,
    created_at: returnRequest.createdAt,
    updated_at: returnRequest.updatedAt,
  };
}

export function toReturnRequestUpdate(returnRequest: ReturnRequest): ReturnRequestUpdate {
  return {
    status: returnRequest.status,
    rma_number: returnRequest.rmaNumber,
    restockable_items:
      returnRequest.restockableItems === null
        ? null
        : JSON.stringify(returnRequest.restockableItems),
    inspection_note: returnRequest.inspectionNote,
    rejection_reason: returnRequest.rejectionReason,
    authorized_at: returnRequest.authorizedAt,
    received_at: returnRequest.receivedAt,
    inspected_at: returnRequest.inspectedAt,
    updated_at: returnRequest.updatedAt,
  };
}
