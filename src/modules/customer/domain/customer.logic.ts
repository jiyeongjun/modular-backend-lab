import { err, ok, type Result } from "../../../shared/result/index.js";
import type {
  CloseCustomerError,
  CreateCustomerError,
  InvalidCustomerInput,
  ReactivateCustomerError,
  SuspendCustomerError,
} from "./customer.errors.js";
import type { CustomerEvent } from "./customer.events.js";
import type { ActiveCustomer, ClosedCustomer, Customer, SuspendedCustomer } from "./customer.js";

export type CreateCustomerInput = Readonly<{
  id: string;
  idempotencyKey: string;
  email: string;
  displayName: string;
  now: Date;
}>;

export type CustomerTransition<T extends Customer> = Readonly<{
  customer: T;
  events: readonly CustomerEvent[];
}>;

export function createCustomer(
  input: CreateCustomerInput,
): Result<ActiveCustomer, CreateCustomerError> {
  const idValidation = validateRequired("id", input.id);
  if (idValidation !== null) {
    return err(idValidation);
  }

  const idempotencyValidation = validateRequired("idempotencyKey", input.idempotencyKey);
  if (idempotencyValidation !== null) {
    return err(idempotencyValidation);
  }

  const email = normalizeCustomerEmail(input.email);
  const emailValidation = validateEmail(email);
  if (emailValidation !== null) {
    return err(emailValidation);
  }

  const displayName = input.displayName.trim();
  const displayNameValidation = validateRequired("displayName", displayName);
  if (displayNameValidation !== null) {
    return err(displayNameValidation);
  }

  return ok({
    id: input.id,
    idempotencyKey: input.idempotencyKey.trim(),
    email,
    displayName,
    status: "ACTIVE",
    suspendedAt: null,
    suspensionReason: null,
    closedAt: null,
    closureReason: null,
    registeredAt: input.now,
    version: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

export function customerRegisteredEvent(customer: ActiveCustomer): CustomerEvent {
  return {
    type: "CustomerRegistered",
    aggregateType: "Customer",
    aggregateId: customer.id,
    occurredAt: customer.registeredAt,
    payload: {
      customerId: customer.id,
      idempotencyKey: customer.idempotencyKey,
      email: customer.email,
      displayName: customer.displayName,
      registeredAt: customer.registeredAt,
    },
  };
}

export function suspendCustomer(
  customer: Customer,
  input: Readonly<{ reason: string; now: Date }>,
): Result<CustomerTransition<SuspendedCustomer>, SuspendCustomerError> {
  const reason = input.reason.trim();
  const reasonValidation = validateRequired("reason", reason);
  if (reasonValidation !== null) {
    return err(reasonValidation);
  }

  switch (customer.status) {
    case "ACTIVE": {
      const suspended: SuspendedCustomer = {
        ...customer,
        status: "SUSPENDED",
        suspendedAt: input.now,
        suspensionReason: reason,
        updatedAt: input.now,
      };
      return ok({
        customer: suspended,
        events: [
          {
            type: "CustomerSuspended",
            aggregateType: "Customer",
            aggregateId: suspended.id,
            occurredAt: input.now,
            payload: {
              customerId: suspended.id,
              email: suspended.email,
              reason,
              suspendedAt: suspended.suspendedAt,
            },
          },
        ],
      });
    }

    case "SUSPENDED":
      return ok({ customer, events: [] });

    case "CLOSED":
      return err({
        type: "CustomerNotSuspendable",
        status: customer.status,
        message: "Closed customers cannot be suspended",
      });
  }
}

export function reactivateCustomer(
  customer: Customer,
  now: Date,
): Result<CustomerTransition<ActiveCustomer>, ReactivateCustomerError> {
  switch (customer.status) {
    case "SUSPENDED": {
      const active: ActiveCustomer = {
        ...customer,
        status: "ACTIVE",
        suspendedAt: null,
        suspensionReason: null,
        closedAt: null,
        closureReason: null,
        updatedAt: now,
      };
      return ok({
        customer: active,
        events: [
          {
            type: "CustomerReactivated",
            aggregateType: "Customer",
            aggregateId: active.id,
            occurredAt: now,
            payload: {
              customerId: active.id,
              email: active.email,
              reactivatedAt: now,
            },
          },
        ],
      });
    }

    case "ACTIVE":
      return ok({ customer, events: [] });

    case "CLOSED":
      return err({
        type: "CustomerNotReactivatable",
        status: customer.status,
        message: "Closed customers cannot be reactivated",
      });
  }
}

export function closeCustomer(
  customer: Customer,
  input: Readonly<{ reason: string; now: Date }>,
): Result<CustomerTransition<ClosedCustomer>, CloseCustomerError> {
  const reason = input.reason.trim();
  const reasonValidation = validateRequired("reason", reason);
  if (reasonValidation !== null) {
    return err(reasonValidation);
  }

  switch (customer.status) {
    case "ACTIVE":
    case "SUSPENDED": {
      const closed: ClosedCustomer = {
        ...customer,
        status: "CLOSED",
        closedAt: input.now,
        closureReason: reason,
        updatedAt: input.now,
      };
      return ok({
        customer: closed,
        events: [
          {
            type: "CustomerClosed",
            aggregateType: "Customer",
            aggregateId: closed.id,
            occurredAt: input.now,
            payload: {
              customerId: closed.id,
              email: closed.email,
              reason,
              closedAt: closed.closedAt,
            },
          },
        ],
      });
    }

    case "CLOSED":
      return ok({ customer, events: [] });
  }
}

export function normalizeCustomerEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateRequired(
  field: InvalidCustomerInput["field"],
  value: string,
): InvalidCustomerInput | null {
  if (value.trim().length === 0) {
    return {
      type: "InvalidCustomerInput",
      field,
      message: `Customer ${field} is required`,
    };
  }

  return null;
}

function validateEmail(email: string): InvalidCustomerInput | null {
  if (!email.includes("@") || email.startsWith("@") || email.endsWith("@")) {
    return {
      type: "InvalidCustomerInput",
      field: "email",
      message: "Customer email is invalid",
    };
  }

  return null;
}
