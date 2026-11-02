import * as Joi from 'joi';

const quantity = Joi.number().integer().min(1).max(99).required();

const cartItem = Joi.object({
  variantId: Joi.string().uuid().required(),
  quantity,
});

export const validateCartSchema = Joi.object({
  items: Joi.array().items(cartItem).min(1).max(50).required(),
});

export const checkoutSchema = Joi.object({
  items: Joi.array().items(cartItem).min(1).max(50).required(),
  addressId: Joi.string().uuid().optional(),
  shippingAddress: Joi.object({
    fullName: Joi.string().trim().min(2).max(120).required(),
    phone: Joi.string().trim().min(6).max(30).required(),
    line1: Joi.string().trim().min(3).max(180).required(),
    line2: Joi.string().trim().max(180).allow('', null).optional(),
    city: Joi.string().trim().min(2).max(120).required(),
    region: Joi.string().trim().min(2).max(120).required(),
    postalCode: Joi.string().trim().min(3).max(20).required(),
    countryCode: Joi.string()
      .trim()
      .length(2)
      .pattern(/^[A-Za-z]{2}$/)
      .required(),
  }).optional(),
}).or('addressId', 'shippingAddress');

export const idempotencyKeySchema = Joi.string()
  .guid({ version: ['uuidv4'] })
  .required();
