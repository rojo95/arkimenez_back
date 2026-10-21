import * as dotenv from 'dotenv';

dotenv.config();

// Las pruebas de integración corren siempre contra la base de datos de test.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'arkimenext_test';

// Valores mínimos para poder probar sin depender de todos los secretos del .env.
process.env.APP_ACCESS_TOKEN =
  process.env.APP_ACCESS_TOKEN || 'integration_test_app_token_seguro';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ||
  'integration_test_jwt_secret_de_al_menos_32_caracteres';
process.env.INITIAL_OWNER_EMAIL =
  process.env.INITIAL_OWNER_EMAIL || 'owner.seed.test@tiendalujosa.test';
process.env.INITIAL_OWNER_PASSWORD =
  process.env.INITIAL_OWNER_PASSWORD || 'OwnerSeedTest123';
