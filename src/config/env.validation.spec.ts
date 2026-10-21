import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  const validEnv = {
    DB_HOST: 'localhost',
    DB_NAME: 'arkimenext',
    DB_USER: 'postgres',
    CORS_ORIGINS: 'http://localhost:3000',
    APP_ACCESS_TOKEN: 'tl_test_token_de_al_menos_16_caracteres',
    JWT_ACCESS_SECRET: 'test_jwt_secret_de_al_menos_32_caracteres',
  };

  it('aplica los valores por defecto cuando no se indican', () => {
    const { error, value } = envValidationSchema.validate(validEnv, {
      abortEarly: false,
      allowUnknown: true,
    });

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3001);
    expect(value.DB_DIALECT).toBe('postgres');
    expect(value.DB_PORT).toBe(5432);
    expect(value.DB_SSL).toBe(false);
    expect(value.DB_PASSWORD).toBe('');
    expect(value.ACCESS_TOKEN_TTL).toBe('15m');
    expect(value.REFRESH_TOKEN_TTL_DAYS).toBe(30);
    expect(value.COOKIE_SECURE).toBe(false);
    expect(value.TEST_DB_NAME).toBe('arkimenext_test');
  });

  it('falla si falta DB_NAME (no se degrada la configuración)', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, DB_NAME: undefined },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('DB_NAME');
  });

  it('falla si falta CORS_ORIGINS', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, CORS_ORIGINS: undefined },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('CORS_ORIGINS');
  });

  it('falla si falta APP_ACCESS_TOKEN', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, APP_ACCESS_TOKEN: undefined },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('APP_ACCESS_TOKEN');
  });

  it('rechaza un APP_ACCESS_TOKEN demasiado corto', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, APP_ACCESS_TOKEN: 'corto' },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('APP_ACCESS_TOKEN');
  });

  it('falla si falta JWT_ACCESS_SECRET', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, JWT_ACCESS_SECRET: undefined },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('rechaza un JWT_ACCESS_SECRET demasiado corto', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, JWT_ACCESS_SECRET: 'corto' },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('JWT_ACCESS_SECRET');
  });

  it('exige COOKIE_SECURE=true en producción', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, NODE_ENV: 'production', COOKIE_SECURE: false },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('COOKIE_SECURE');
  });

  it('rechaza un NODE_ENV desconocido', () => {
    const { error } = envValidationSchema.validate(
      { ...validEnv, NODE_ENV: 'staging' },
      { abortEarly: false, allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('NODE_ENV');
  });
});
