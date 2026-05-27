import { z } from "zod";

const AddressFieldsSchema = z.object({
  label: z.string().trim().min(1).nullable().optional(),
  recipientName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  line1: z.string().trim().min(1),
  line2: z.string().trim().min(1).nullable().optional(),
  city: z.string().trim().min(1),
  region: z.string().trim().min(1).nullable().optional(),
  postalCode: z.string().trim().min(1),
  country: z.string().trim().min(1),
});

export const AddressParamsSchema = z.object({
  addressId: z.string().trim().min(1),
});

export const AddAddressBodySchema = AddressFieldsSchema.extend({
  customerId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
  purpose: z.enum(["SHIPPING", "BILLING"]),
  makeDefault: z.boolean().optional(),
});

export const UpdateAddressBodySchema = AddressFieldsSchema;

export const DisableAddressBodySchema = z.object({
  reason: z.string().trim().min(1),
});
