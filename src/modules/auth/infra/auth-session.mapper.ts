import type {
  AuthSessionInsert,
  AuthSessionRow,
  AuthSessionUpdate,
} from "../../../infra/db/database.js";
import type {
  ActiveAuthSession,
  AuthSession,
  AuthSessionStatus,
  ExpiredAuthSession,
  RevokedAuthSession,
} from "../domain/index.js";

function toStatus(value: string): AuthSessionStatus {
  if (value === "ACTIVE" || value === "REVOKED" || value === "EXPIRED") {
    return value;
  }
  throw new Error(`Unknown auth session status: ${value}`);
}

function base(row: AuthSessionRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    credentialId: row.credential_id,
    tokenHash: row.token_hash,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAuthSession(row: AuthSessionRow): AuthSession {
  switch (toStatus(row.status)) {
    case "ACTIVE": {
      if (row.revoked_at !== null || row.expired_at !== null) {
        throw new Error(`Active auth session ${row.id} has non-active columns`);
      }
      const session: ActiveAuthSession = {
        ...base(row),
        status: "ACTIVE",
        revokedAt: null,
        expiredAt: null,
      };
      return session;
    }

    case "REVOKED": {
      if (row.revoked_at === null || row.expired_at !== null) {
        throw new Error(`Revoked auth session ${row.id} has invalid columns`);
      }
      const session: RevokedAuthSession = {
        ...base(row),
        status: "REVOKED",
        revokedAt: row.revoked_at,
        expiredAt: null,
      };
      return session;
    }

    case "EXPIRED": {
      if (row.revoked_at !== null || row.expired_at === null) {
        throw new Error(`Expired auth session ${row.id} has invalid columns`);
      }
      const session: ExpiredAuthSession = {
        ...base(row),
        status: "EXPIRED",
        revokedAt: null,
        expiredAt: row.expired_at,
      };
      return session;
    }
  }
}

export function toAuthSessionInsert(session: AuthSession): AuthSessionInsert {
  return {
    id: session.id,
    customer_id: session.customerId,
    credential_id: session.credentialId,
    token_hash: session.tokenHash,
    status: session.status,
    issued_at: session.issuedAt,
    expires_at: session.expiresAt,
    revoked_at: session.revokedAt,
    expired_at: session.expiredAt,
    version: session.version,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
  };
}

export function toAuthSessionUpdate(session: AuthSession): AuthSessionUpdate {
  return {
    status: session.status,
    revoked_at: session.revokedAt,
    expired_at: session.expiredAt,
    updated_at: session.updatedAt,
  };
}
