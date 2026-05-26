import type { FulfillmentStatus } from "./fulfillment.js";

export type CreateFulfillmentError =
  | {
      type: "InvalidFulfillmentPackage";
      message: string;
    }
  | {
      type: "InvalidFulfillmentInput";
      field: "id" | "orderId" | "idempotencyKey";
      message: string;
    };

export type PackFulfillmentError = {
  type: "FulfillmentNotPackable";
  status: FulfillmentStatus;
  message: string;
};

export type PurchaseShippingLabelError =
  | {
      type: "FulfillmentNotLabelable";
      status: FulfillmentStatus;
      message: string;
    }
  | {
      type: "InvalidShippingLabel";
      message: string;
    };

export type CancelFulfillmentError = {
  type: "FulfillmentNotCancellable";
  status: FulfillmentStatus;
  message: string;
};

export type ApplyCarrierStatusError =
  | {
      type: "FulfillmentNotTrackable";
      status: FulfillmentStatus;
      message: string;
    }
  | {
      type: "UnsupportedCarrierStatusTransition";
      currentStatus: FulfillmentStatus;
      carrierStatus: string;
      message: string;
    };
