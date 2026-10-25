import * as Joi from 'joi';

/**
 * Esquema de validación de variables de entorno (SDD §10).
 *
 * El arranque falla si falta una variable obligatoria: no se degrada la
 * seguridad ante configuración incompleta.
 *
 * Las variables de sesiones se incorporan en la Fase 2 (ADR-0002). Las de
 * imágenes y correo se endurecen al implementar sus fases.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3001),

  // Base de datos
  DB_DIALECT: Joi.string().valid('postgres').default('postgres'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  TEST_DB_NAME: Joi.string().default('arkimenext_test'),

  // CORS
  CORS_ORIGINS: Joi.string().required(),

  // Clave compartida con el frontend (cabecera x-app-token)
  APP_ACCESS_TOKEN: Joi.string().min(16).required(),

  // Sesiones (ADR-0002)
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(30),
  PASSWORD_RESET_TTL_MINUTES: Joi.number()
    .integer()
    .min(5)
    .max(1440)
    .default(60),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),
  COOKIE_SECURE: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(false)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.boolean().valid(true).required(),
    }),

  // Valores iniciales de la tienda (los usa el seeder)
  STORE_NAME: Joi.string().default('tiendaLujosa'),
  DEFAULT_LOCALE: Joi.string().default('es'),
  ACTIVE_LOCALES: Joi.string().default('es,en'),
  STORE_CURRENCY: Joi.string().length(3).default('EUR'),

  // Imágenes (ADR-0004). `local` no está permitido en producción.
  STORAGE_DRIVER: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().valid('s3').required(),
    otherwise: Joi.string().valid('local', 's3').default('local'),
  }),
  STORAGE_LOCAL_DIR: Joi.string().default('./.uploads'),
  MAX_IMAGE_SIZE_MB: Joi.number().integer().min(1).max(20).default(5),
  S3_ENDPOINT: Joi.string()
    .uri()
    .allow('')
    .when('STORAGE_DRIVER', { is: 's3', then: Joi.string().uri().required() }),
  S3_REGION: Joi.string()
    .allow('')
    .when('STORAGE_DRIVER', { is: 's3', then: Joi.string().required() }),
  S3_BUCKET: Joi.string()
    .allow('')
    .when('STORAGE_DRIVER', { is: 's3', then: Joi.string().required() }),
  S3_ACCESS_KEY_ID: Joi.string()
    .allow('')
    .when('STORAGE_DRIVER', { is: 's3', then: Joi.string().required() }),
  S3_SECRET_ACCESS_KEY: Joi.string()
    .allow('')
    .when('STORAGE_DRIVER', { is: 's3', then: Joi.string().required() }),
  S3_PUBLIC_BASE_URL: Joi.string().uri().allow('').when('STORAGE_DRIVER', {
    is: 's3',
    then: Joi.string().uri().required(),
  }),

  // Correo (Mailpit local en desarrollo)
  MAIL_HOST: Joi.string().default('localhost'),
  MAIL_PORT: Joi.number().port().default(1025),
  MAIL_USER: Joi.string().allow('').default(''),
  MAIL_PASSWORD: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string()
    .email({ tlds: { allow: false } })
    .default('no-reply@tiendalujosa.local'),

  // Primer OWNER (solo lo exige el seeder, no el arranque)
  INITIAL_OWNER_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .allow('')
    .optional(),
  INITIAL_OWNER_PASSWORD: Joi.string().min(10).max(128).allow('').optional(),
});
