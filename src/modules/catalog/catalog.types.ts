import type { ProductStatus, ProductType } from './models/product.model';

export interface TranslationInput {
  locale: string;
  name: string;
  slug?: string;
  description?: string | null;
}

export interface VariantInput {
  sku: string;
  priceMinor?: number | null;
  optionValueIds?: string[];
  initialStock?: number;
  allowBackorder?: boolean;
  isActive?: boolean;
}

export interface CreateProductInput {
  type: ProductType;
  basePriceMinor: number;
  translations: TranslationInput[];
  categoryIds?: string[];
  variants?: VariantInput[];
}

export interface UpdateProductInput {
  basePriceMinor?: number;
  translations?: TranslationInput[];
  categoryIds?: string[];
}

export interface UpdateVariantInput {
  priceMinor?: number | null;
  isActive?: boolean;
}

export interface CreateCategoryInput {
  isActive?: boolean;
  translations: TranslationInput[];
}

export interface UpdateCategoryInput {
  isActive?: boolean;
  translations?: TranslationInput[];
}

export interface NamedTranslationInput {
  locale: string;
  name: string;
}

export interface CreateAttributeInput {
  code: string;
  isVariantAxis?: boolean;
  translations: NamedTranslationInput[];
}

export interface UpdateAttributeInput {
  isVariantAxis?: boolean;
  translations?: NamedTranslationInput[];
}

export interface CreateAttributeValueInput {
  code: string;
  translations: NamedTranslationInput[];
}

export interface UpdateAttributeValueInput {
  translations: NamedTranslationInput[];
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc';

export interface ListProductsQuery {
  page: number;
  pageSize: number;
  locale?: string;
  category?: string;
  q?: string;
  sort: ProductSort;
  availability?: 'in_stock';
}

export interface AdminProductsQuery {
  page: number;
  pageSize: number;
  status?: ProductStatus;
  locale?: string;
}
