export type AddressPurpose = "SHIPPING" | "BILLING";

export type AddressStatus = "ACTIVE" | "DISABLED";

export type AddressFields = Readonly<{
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
}>;

type AddressBase = AddressFields &
  Readonly<{
    id: string;
    customerId: string;
    idempotencyKey: string;
    purpose: AddressPurpose;
    isDefault: boolean;
    addedAt: Date;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>;

export type ActiveAddress = AddressBase &
  Readonly<{
    status: "ACTIVE";
    disabledAt: null;
    disableReason: null;
  }>;

export type DisabledAddress = AddressBase &
  Readonly<{
    status: "DISABLED";
    isDefault: false;
    disabledAt: Date;
    disableReason: string;
  }>;

export type Address = ActiveAddress | DisabledAddress;
