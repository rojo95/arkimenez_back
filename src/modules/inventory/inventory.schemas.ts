import * as Joi from 'joi';

export const inventoryListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const movementListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const adjustStockSchema = Joi.object({
  quantity: Joi.number().integer().min(0).optional(),
  delta: Joi.number().integer().not(0).optional(),
  allowBackorder: Joi.boolean().optional(),
  note: Joi.string().trim().min(3).max(255).required(),
})
  .xor('quantity', 'delta')
  .messages({
    'object.xor': 'Debes indicar quantity o delta, pero no ambos',
  });

export const variantParamSchema = Joi.object({
  variantId: Joi.string().uuid().required(),
});
