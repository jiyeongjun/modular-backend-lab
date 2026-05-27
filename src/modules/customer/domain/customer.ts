export type CustomerStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

type CustomerBase = Readonly<{
  id: string;
  idempotencyKey: string;
  email: string;
  displayName: string;
  registeredAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActiveCustomer = CustomerBase &
  Readonly<{
    status: "ACTIVE";
    suspendedAt: null;
    suspensionReason: null;
    closedAt: null;
    closureReason: null;
  }>;

export type SuspendedCustomer = CustomerBase &
  Readonly<{
    status: "SUSPENDED";
    suspendedAt: Date;
    suspensionReason: string;
    closedAt: null;
    closureReason: null;
  }>;

export type ClosedCustomer = CustomerBase &
  Readonly<{
    status: "CLOSED";
    suspendedAt: Date | null;
    suspensionReason: string | null;
    closedAt: Date;
    closureReason: string;
  }>;

export type Customer = ActiveCustomer | SuspendedCustomer | ClosedCustomer;
