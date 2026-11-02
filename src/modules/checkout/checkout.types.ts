import type { ShippingAddressSnapshot } from '../orders/models/order.model';

export interface CartValidateItem {
  variantId: string;
}

export interface CartValidateInput {
  items: Array<{ variantId: string; quantity: number }>;
}

export interface ValidatedCartLine {
  variantId: string;
  productId: string;
  sku: string;
  name: string;
  options: string | null;
  unitPriceMinor: number;
  quantity: number;
  available: boolean;
  stockQuantity: number;
  lineTotalMinor: number;
}

export interface ValidatedCart {
  currency: string;
  items: ValidatedCartLine[];
  subtotalMinor: number;
}

export interface CheckoutInput {
  items: Array<{ variantId: string; quantity: number }>;
  addressId?: string;
  shippingAddress?: ShippingAddressSnapshot;
}
