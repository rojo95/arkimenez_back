import * as Joi from 'joi';

export const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
});

export const addressSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(120).required(),
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
  phone: Joi.string().trim().min(6).max(30).required(),
});

export const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
});
