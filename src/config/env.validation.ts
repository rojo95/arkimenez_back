import * as Joi from 'joi';

/**
 * Esquema de validación de variables de entorno (SDD §10).
 *
 * El arranque falla si falta una variable obligatoria: no se degrada la
 * seguridad ante configuración incompleta.
 *
 * La conexión usa el mismo patrón de variables que SmartBucks (DB_*).
 * Solo son obligatorias las variables que la Fase 1 necesita. Las de sesiones,
 * imágenes y correo (ADR-0002/0004) se endurecen al implementar sus fases.
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

  // CORS
  CORS_ORIGINS: Joi.string().required(),

  // Clave compartida con el frontend (cabecera x-app-token)
  APP_ACCESS_TOKEN: Joi.string().min(16).required(),
});
