export interface PublicUser {
  id: string;
  name: string;
  email: string;
  isStaff: boolean;
}

export interface AddressInput {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
}

export interface PublicAddress extends AddressInput {
  id: string;
  line2: string | null;
}
