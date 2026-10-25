import * as Joi from 'joi';

const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(320)
  .required();
const password = Joi.string().min(10).max(128).required();

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  email,
  password,
});

export const loginSchema = Joi.object({
  email,
  password: Joi.string().min(1).max(128).required(),
});

export const forgotPasswordSchema = Joi.object({ email });

export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .trim()
    .min(32)
    .max(128)
    .pattern(/^[A-Za-z0-9_-]+$/)
    .required(),
  password,
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword: password,
});
