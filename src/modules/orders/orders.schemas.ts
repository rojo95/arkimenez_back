import * as Joi from 'joi';

export const listOrdersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const orderIdParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});

export const updateOrderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    .required(),
  note: Joi.string().trim().max(500).allow('').optional(),
});
