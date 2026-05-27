import type { CustomerInsert, CustomerRow, CustomerUpdate } from "../../../infra/db/database.js";
import type {
  ActiveCustomer,
  ClosedCustomer,
  Customer,
  CustomerStatus,
  SuspendedCustomer,
} from "../domain/index.js";

function toStatus(value: string): CustomerStatus {
  if (value === "ACTIVE" || value === "SUSPENDED" || value === "CLOSED") {
    return value;
  }
  throw new Error(`Unknown customer status: ${value}`);
}

function base(row: CustomerRow) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    email: row.email,
    displayName: row.display_name,
    registeredAt: row.registered_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCustomer(row: CustomerRow): Customer {
  switch (toStatus(row.status)) {
    case "ACTIVE": {
      if (
        row.suspended_at !== null ||
        row.suspension_reason !== null ||
        row.closed_at !== null ||
        row.closure_reason !== null
      ) {
        throw new Error(`Active customer ${row.id} has non-active columns`);
      }
      const customer: ActiveCustomer = {
        ...base(row),
        status: "ACTIVE",
        suspendedAt: null,
        suspensionReason: null,
        closedAt: null,
        closureReason: null,
      };
      return customer;
    }

    case "SUSPENDED": {
      if (
        row.suspended_at === null ||
        row.suspension_reason === null ||
        row.closed_at !== null ||
        row.closure_reason !== null
      ) {
        throw new Error(`Suspended customer ${row.id} has invalid columns`);
      }
      const customer: SuspendedCustomer = {
        ...base(row),
        status: "SUSPENDED",
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        closedAt: null,
        closureReason: null,
      };
      return customer;
    }

    case "CLOSED": {
      if (
        row.closed_at === null ||
        row.closure_reason === null ||
        (row.suspended_at === null && row.suspension_reason !== null) ||
        (row.suspended_at !== null && row.suspension_reason === null)
      ) {
        throw new Error(`Closed customer ${row.id} has invalid columns`);
      }
      const customer: ClosedCustomer = {
        ...base(row),
        status: "CLOSED",
        suspendedAt: row.suspended_at,
        suspensionReason: row.suspension_reason,
        closedAt: row.closed_at,
        closureReason: row.closure_reason,
      };
      return customer;
    }
  }
}

export function toCustomerInsert(customer: Customer): CustomerInsert {
  return {
    id: customer.id,
    idempotency_key: customer.idempotencyKey,
    email: customer.email,
    display_name: customer.displayName,
    status: customer.status,
    suspension_reason: customer.suspensionReason,
    closure_reason: customer.closureReason,
    registered_at: customer.registeredAt,
    suspended_at: customer.suspendedAt,
    closed_at: customer.closedAt,
    version: customer.version,
    created_at: customer.createdAt,
    updated_at: customer.updatedAt,
  };
}

export function toCustomerUpdate(customer: Customer): CustomerUpdate {
  return {
    status: customer.status,
    suspension_reason: customer.suspensionReason,
    closure_reason: customer.closureReason,
    suspended_at: customer.suspendedAt,
    closed_at: customer.closedAt,
    updated_at: customer.updatedAt,
  };
}
