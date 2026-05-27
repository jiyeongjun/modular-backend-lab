import type {
  AuthEmailCredentialInsert,
  AuthEmailCredentialRow,
  AuthEmailCredentialUpdate,
} from "../../../infra/db/database.js";
import type {
  ActiveEmailCredential,
  DisabledEmailCredential,
  EmailCredential,
  EmailCredentialStatus,
  LockedEmailCredential,
} from "../domain/index.js";

function toStatus(value: string): EmailCredentialStatus {
  if (value === "ACTIVE" || value === "LOCKED" || value === "DISABLED") {
    return value;
  }
  throw new Error(`Unknown auth credential status: ${value}`);
}

function base(row: AuthEmailCredentialRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    idempotencyKey: row.idempotency_key,
    email: row.email,
    passwordHash: row.password_hash,
    failedLoginCount: row.failed_login_count,
    registeredAt: row.registered_at,
    passwordUpdatedAt: row.password_updated_at,
    lastLoginAt: row.last_login_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toEmailCredential(row: AuthEmailCredentialRow): EmailCredential {
  switch (toStatus(row.status)) {
    case "ACTIVE": {
      if (row.locked_at !== null || row.disabled_at !== null) {
        throw new Error(`Active auth credential ${row.id} has non-active columns`);
      }
      const credential: ActiveEmailCredential = {
        ...base(row),
        status: "ACTIVE",
        lockedAt: null,
        disabledAt: null,
      };
      return credential;
    }

    case "LOCKED": {
      if (row.locked_at === null || row.disabled_at !== null) {
        throw new Error(`Locked auth credential ${row.id} has invalid columns`);
      }
      const credential: LockedEmailCredential = {
        ...base(row),
        status: "LOCKED",
        lockedAt: row.locked_at,
        disabledAt: null,
      };
      return credential;
    }

    case "DISABLED": {
      if (row.disabled_at === null) {
        throw new Error(`Disabled auth credential ${row.id} has invalid columns`);
      }
      const credential: DisabledEmailCredential = {
        ...base(row),
        status: "DISABLED",
        lockedAt: row.locked_at,
        disabledAt: row.disabled_at,
      };
      return credential;
    }
  }
}

export function toEmailCredentialInsert(credential: EmailCredential): AuthEmailCredentialInsert {
  return {
    id: credential.id,
    customer_id: credential.customerId,
    idempotency_key: credential.idempotencyKey,
    email: credential.email,
    password_hash: credential.passwordHash,
    status: credential.status,
    failed_login_count: credential.failedLoginCount,
    registered_at: credential.registeredAt,
    password_updated_at: credential.passwordUpdatedAt,
    last_login_at: credential.lastLoginAt,
    locked_at: credential.lockedAt,
    disabled_at: credential.disabledAt,
    version: credential.version,
    created_at: credential.createdAt,
    updated_at: credential.updatedAt,
  };
}

export function toEmailCredentialUpdate(credential: EmailCredential): AuthEmailCredentialUpdate {
  return {
    password_hash: credential.passwordHash,
    status: credential.status,
    failed_login_count: credential.failedLoginCount,
    password_updated_at: credential.passwordUpdatedAt,
    last_login_at: credential.lastLoginAt,
    locked_at: credential.lockedAt,
    disabled_at: credential.disabledAt,
    updated_at: credential.updatedAt,
  };
}
