import * as Joi from 'joi';

const locale = Joi.string().lowercase().max(5);
const slug = Joi.string()
  .lowercase()
  .max(180)
  .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const description = Joi.string().max(5000).allow('', null);

const translation = Joi.object({
  locale: locale.required(),
  name: Joi.string().max(160).required(),
  slug: slug.optional(),
  description: description.optional(),
});

const categoryTranslation = Joi.object({
  locale: locale.required(),
  name: Joi.string().max(120).required(),
  slug: Joi.string()
    .lowercase()
    .max(160)
    .pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  description: description.optional(),
});

const namedTranslation = Joi.object({
  locale: locale.required(),
  name: Joi.string().max(80).required(),
});

const variant = Joi.object({
  sku: Joi.string().trim().max(64).required(),
  priceMinor: Joi.number().integer().min(0).allow(null).optional(),
  optionValueIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  initialStock: Joi.number().integer().min(0).default(0),
  allowBackorder: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

export const createProductSchema = Joi.object({
  type: Joi.string().valid('SIMPLE', 'VARIABLE').required(),
  basePriceMinor: Joi.number().integer().min(0).required(),
  translations: Joi.array().items(translation).min(1).required(),
  categoryIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  variants: Joi.array().items(variant).default([]),
});

export const updateProductSchema = Joi.object({
  basePriceMinor: Joi.number().integer().min(0).optional(),
  translations: Joi.array().items(translation).min(1).optional(),
  categoryIds: Joi.array().items(Joi.string().uuid()).unique().optional(),
}).min(1);

export const updateVariantSchema = Joi.object({
  priceMinor: Joi.number().integer().min(0).allow(null).optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

export const createCategorySchema = Joi.object({
  isActive: Joi.boolean().default(true),
  translations: Joi.array().items(categoryTranslation).min(1).required(),
});

export const updateCategorySchema = Joi.object({
  isActive: Joi.boolean().optional(),
  translations: Joi.array().items(categoryTranslation).min(1).optional(),
}).min(1);

export const createAttributeSchema = Joi.object({
  code: Joi.string()
    .trim()
    .lowercase()
    .max(60)
    .pattern(/^[a-z0-9_]+$/)
    .required(),
  isVariantAxis: Joi.boolean().default(true),
  translations: Joi.array().items(namedTranslation).min(1).required(),
});

export const updateAttributeSchema = Joi.object({
  isVariantAxis: Joi.boolean().optional(),
  translations: Joi.array().items(namedTranslation).min(1).optional(),
}).min(1);

export const createAttributeValueSchema = Joi.object({
  code: Joi.string()
    .trim()
    .max(60)
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .required(),
  translations: Joi.array().items(namedTranslation).min(1).required(),
});

export const updateAttributeValueSchema = Joi.object({
  translations: Joi.array().items(namedTranslation).min(1).required(),
});

export const listProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  locale: locale.optional(),
  category: Joi.string().max(180).optional(),
  q: Joi.string().trim().max(120).optional(),
  sort: Joi.string()
    .valid('newest', 'price_asc', 'price_desc')
    .default('newest'),
  availability: Joi.string().valid('in_stock').optional(),
});

export const adminProductsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
  locale: locale.optional(),
});

export const addImageSchema = Joi.object({
  alt: Joi.string().max(255).allow('', null).optional(),
});

export const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

export const productIdentifierParamSchema = Joi.object({
  slugOrId: Joi.string().max(180).required(),
});

export const productIdParamSchema = Joi.object({
  productId: Joi.string().uuid().required(),
});

export const productImageParamSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  imageId: Joi.string().uuid().required(),
});

export const productVariantParamSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  variantId: Joi.string().uuid().required(),
});

export const attributeValueParamSchema = Joi.object({
  attributeId: Joi.string().uuid().required(),
});

export const attributeValueUpdateParamSchema = Joi.object({
  attributeId: Joi.string().uuid().required(),
  valueId: Joi.string().uuid().required(),
});

export const publicLocaleQuerySchema = Joi.object({
  locale: locale.optional(),
});
