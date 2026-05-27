export type AuthSessionStatus = "ACTIVE" | "REVOKED" | "EXPIRED";

type AuthSessionBase = Readonly<{
  id: string;
  customerId: string;
  credentialId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ActiveAuthSession = AuthSessionBase &
  Readonly<{
    status: "ACTIVE";
    revokedAt: null;
    expiredAt: null;
  }>;

export type RevokedAuthSession = AuthSessionBase &
  Readonly<{
    status: "REVOKED";
    revokedAt: Date;
    expiredAt: null;
  }>;

export type ExpiredAuthSession = AuthSessionBase &
  Readonly<{
    status: "EXPIRED";
    revokedAt: null;
    expiredAt: Date;
  }>;

export type AuthSession = ActiveAuthSession | RevokedAuthSession | ExpiredAuthSession;
