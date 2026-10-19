import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

/**
 * Prueba e2e del endpoint de salud.
 *
 * Requiere un `.env` válido y PostgreSQL en marcha (docker compose up -d postgres):
 * la prueba comprueba la conexión real a la base de datos.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health responde ok con la base de datos arriba', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-app-token', process.env.APP_ACCESS_TOKEN ?? '')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.database).toBe('up');
      });
  });

  it('GET /api/v1/health sin x-app-token responde 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(401)
      .expect((res) => {
        expect(res.body.error.code).toBe('APP_TOKEN_REQUIRED');
      });
  });
});
