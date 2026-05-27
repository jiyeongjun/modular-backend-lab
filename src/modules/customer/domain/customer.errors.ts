import type { CustomerStatus } from "./customer.js";

export type InvalidCustomerInput = Readonly<{
  type: "InvalidCustomerInput";
  field: "id" | "idempotencyKey" | "email" | "displayName" | "reason";
  message: string;
}>;

export type CustomerNotSuspendable = Readonly<{
  type: "CustomerNotSuspendable";
  status: CustomerStatus;
  message: string;
}>;

export type CustomerNotReactivatable = Readonly<{
  type: "CustomerNotReactivatable";
  status: CustomerStatus;
  message: string;
}>;

export type CreateCustomerError = InvalidCustomerInput;
export type SuspendCustomerError = InvalidCustomerInput | CustomerNotSuspendable;
export type ReactivateCustomerError = CustomerNotReactivatable;
export type CloseCustomerError = InvalidCustomerInput;
