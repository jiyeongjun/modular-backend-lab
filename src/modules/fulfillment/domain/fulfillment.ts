export type FulfillmentStatus =
  | "READY"
  | "PACKED"
  | "LABEL_PURCHASED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type CarrierCode = "LOCAL_TEST_CARRIER";

export type CarrierShipmentStatus = "CREATED" | "IN_TRANSIT" | "DELIVERED";

export type ShippingAddress = Readonly<{
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  country: "KR" | "US";
}>;

export type ShipmentPackage = Readonly<{
  weightGrams: number;
  description: string | null;
}>;

export type PurchasedShippingLabel = Readonly<{
  carrier: CarrierCode;
  carrierShipmentId: string;
  trackingNumber: string;
  carrierStatus: CarrierShipmentStatus;
  purchasedAt: Date;
}>;

type FulfillmentBase = Readonly<{
  id: string;
  orderId: string;
  idempotencyKey: string;
  recipient: ShippingAddress;
  package: ShipmentPackage;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

type NoLabelFields = Readonly<{
  labelIdempotencyKey: null;
  carrier: null;
  carrierShipmentId: null;
  trackingNumber: null;
  carrierStatus: null;
  labelPurchasedAt: null;
  shippedAt: null;
  deliveredAt: null;
}>;

type LabelFields = Readonly<{
  labelIdempotencyKey: string;
  carrier: CarrierCode;
  carrierShipmentId: string;
  trackingNumber: string;
  labelPurchasedAt: Date;
}>;

export type ReadyFulfillment = FulfillmentBase &
  NoLabelFields &
  Readonly<{
    status: "READY";
    packedAt: null;
    cancelledAt: null;
    cancelReason: null;
  }>;

export type PackedFulfillment = FulfillmentBase &
  NoLabelFields &
  Readonly<{
    status: "PACKED";
    packedAt: Date;
    cancelledAt: null;
    cancelReason: null;
  }>;

export type LabelPurchasedFulfillment = FulfillmentBase &
  LabelFields &
  Readonly<{
    status: "LABEL_PURCHASED";
    packedAt: Date;
    carrierStatus: "CREATED";
    shippedAt: null;
    deliveredAt: null;
    cancelledAt: null;
    cancelReason: null;
  }>;

export type ShippedFulfillment = FulfillmentBase &
  LabelFields &
  Readonly<{
    status: "SHIPPED";
    packedAt: Date;
    carrierStatus: "IN_TRANSIT";
    shippedAt: Date;
    deliveredAt: null;
    cancelledAt: null;
    cancelReason: null;
  }>;

export type DeliveredFulfillment = FulfillmentBase &
  LabelFields &
  Readonly<{
    status: "DELIVERED";
    packedAt: Date;
    carrierStatus: "DELIVERED";
    shippedAt: Date;
    deliveredAt: Date;
    cancelledAt: null;
    cancelReason: null;
  }>;

export type CancelledFulfillment = FulfillmentBase &
  NoLabelFields &
  Readonly<{
    status: "CANCELLED";
    packedAt: Date | null;
    cancelledAt: Date;
    cancelReason: string;
  }>;

export type TrackableFulfillment =
  | LabelPurchasedFulfillment
  | ShippedFulfillment
  | DeliveredFulfillment;

export type Fulfillment =
  | ReadyFulfillment
  | PackedFulfillment
  | LabelPurchasedFulfillment
  | ShippedFulfillment
  | DeliveredFulfillment
  | CancelledFulfillment;
