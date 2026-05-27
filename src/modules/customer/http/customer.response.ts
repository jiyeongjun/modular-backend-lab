import type { Result } from "../../../shared/result/index.js";
import type {
  CloseCustomerUseCaseError,
  CloseCustomerUseCaseResult,
  ReactivateCustomerUseCaseError,
  ReactivateCustomerUseCaseResult,
  RegisterCustomerUseCaseError,
  RegisterCustomerUseCaseResult,
  SuspendCustomerUseCaseError,
  SuspendCustomerUseCaseResult,
} from "../application/index.js";
import type { Customer } from "../domain/index.js";

export type CustomerHttpResponseShape = Readonly<{
  status: 200 | 201 | 400 | 404 | 409;
  body: unknown;
}>;

export function serializeCustomer(customer: Customer): Record<string, unknown> {
  return {
    id: customer.id,
    idempotencyKey: customer.idempotencyKey,
    email: customer.email,
    displayName: customer.displayName,
    status: customer.status,
    suspensionReason: customer.suspensionReason,
    closureReason: customer.closureReason,
    registeredAt: customer.registeredAt.toISOString(),
    suspendedAt: customer.suspendedAt?.toISOString() ?? null,
    closedAt: customer.closedAt?.toISOString() ?? null,
    version: customer.version,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
  };
}

export function mapRegisterCustomerResult(
  result: Result<RegisterCustomerUseCaseResult, RegisterCustomerUseCaseError>,
): CustomerHttpResponseShape {
  if (result.ok) {
    return {
      status: result.value.idempotent ? 200 : 201,
      body: {
        data: serializeCustomer(result.value.customer),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapCustomerError(result.error);
}

export function mapSuspendCustomerResult(
  result: Result<SuspendCustomerUseCaseResult, SuspendCustomerUseCaseError>,
): CustomerHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeCustomer(result.value.customer),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapCustomerError(result.error);
}

export function mapReactivateCustomerResult(
  result: Result<ReactivateCustomerUseCaseResult, ReactivateCustomerUseCaseError>,
): CustomerHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeCustomer(result.value.customer),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapCustomerError(result.error);
}

export function mapCloseCustomerResult(
  result: Result<CloseCustomerUseCaseResult, CloseCustomerUseCaseError>,
): CustomerHttpResponseShape {
  if (result.ok) {
    return {
      status: 200,
      body: {
        data: serializeCustomer(result.value.customer),
        idempotent: result.value.idempotent,
      },
    };
  }

  return mapCustomerError(result.error);
}

function mapCustomerError(
  error:
    | RegisterCustomerUseCaseError
    | SuspendCustomerUseCaseError
    | ReactivateCustomerUseCaseError
    | CloseCustomerUseCaseError,
): CustomerHttpResponseShape {
  switch (error.type) {
    case "InvalidCustomerInput":
      return { status: 400, body: { error } };

    case "CustomerNotFound":
      return { status: 404, body: { error } };

    case "CustomerEmailAlreadyRegistered":
    case "CustomerRegistrationIdempotencyConflict":
    case "CustomerNotSuspendable":
    case "CustomerNotReactivatable":
      return { status: 409, body: { error } };
  }
}
