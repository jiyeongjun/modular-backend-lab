export type EmailCredentialStatus = "ACTIVE" | "LOCKED" | "DISABLED";

type EmailCredentialBase = Readonly<{
  id: string;
  customerId: string;
  idempotencyKey: string;
  email: string;
  passwordHash: string;
  failedLoginCount: number;
  registeredAt: Date;
  passwordUpdatedAt: Date;
  lastLoginAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActiveEmailCredential = EmailCredentialBase &
  Readonly<{
    status: "ACTIVE";
    lockedAt: null;
    disabledAt: null;
  }>;

export type LockedEmailCredential = EmailCredentialBase &
  Readonly<{
    status: "LOCKED";
    lockedAt: Date;
    disabledAt: null;
  }>;

export type DisabledEmailCredential = EmailCredentialBase &
  Readonly<{
    status: "DISABLED";
    lockedAt: Date | null;
    disabledAt: Date;
  }>;

export type EmailCredential =
  | ActiveEmailCredential
  | LockedEmailCredential
  | DisabledEmailCredential;
