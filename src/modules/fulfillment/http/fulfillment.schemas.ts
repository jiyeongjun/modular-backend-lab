import { z } from "zod";

export const ShippingAddressSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().min(1).nullable().default(null),
  postalCode: z.string().min(1),
  country: z.enum(["KR", "US"]),
});

export const ShipmentPackageSchema = z.object({
  weightGrams: z.number().int().positive(),
  description: z.string().min(1).nullable().default(null),
});

export const CreateFulfillmentBodySchema = z.object({
  orderId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  recipient: ShippingAddressSchema,
  package: ShipmentPackageSchema,
});

export const FulfillmentIdParamsSchema = z.object({
  fulfillmentId: z.string().min(1),
});

export const PurchaseShippingLabelBodySchema = z.object({
  idempotencyKey: z.string().min(1),
});

export const CancelFulfillmentBodySchema = z.object({
  reason: z.string().min(1),
});
