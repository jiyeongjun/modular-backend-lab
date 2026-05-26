import type { Money } from "../../../shared/money/index.js";
import type { CouponRedemptionStatus, CouponStatus } from "./coupon.js";

export type CouponInputField =
  | "id"
  | "code"
  | "discount"
  | "minOrderAmount"
  | "eligibleSkus"
  | "maxRedemptions"
  | "startsAt"
  | "expiresAt";

export type CreateCouponError =
  | {
      type: "InvalidCouponInput";
      field: CouponInputField;
      message: string;
    }
  | {
      type: "CouponCurrencyMismatch";
      expectedCurrency: Money["currency"];
      actualCurrency: Money["currency"];
      message: string;
    };

export type QuoteCouponError =
  | {
      type: "CouponInactive";
      status: CouponStatus;
      message: string;
    }
  | {
      type: "CouponNotStarted";
      startsAt: Date;
      message: string;
    }
  | {
      type: "CouponExpired";
      expiresAt: Date;
      message: string;
    }
  | {
      type: "CouponUsageLimitReached";
      maxRedemptions: number;
      message: string;
    }
  | {
      type: "CouponCurrencyMismatch";
      expectedCurrency: Money["currency"];
      actualCurrency: Money["currency"];
      message: string;
    }
  | {
      type: "CouponMinimumOrderNotMet";
      minOrderAmount: Money;
      orderAmount: Money;
      message: string;
    }
  | {
      type: "CouponSkuNotEligible";
      eligibleSkus: readonly string[];
      requestedSkus: readonly string[];
      message: string;
    };

export type ReserveCouponError = QuoteCouponError;

export type CommitCouponRedemptionError = {
  type: "CouponRedemptionNotCommittable";
  status: CouponRedemptionStatus;
  message: string;
};

export type ReleaseCouponRedemptionError = {
  type: "CouponRedemptionNotReleasable";
  status: CouponRedemptionStatus;
  message: string;
};
