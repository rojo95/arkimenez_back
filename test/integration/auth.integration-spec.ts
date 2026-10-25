import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { AuthMailService } from '../../src/modules/auth/auth.mail';
import { Role } from '../../src/modules/roles-permissions/models/role.model';
import { UserRole } from '../../src/modules/roles-permissions/models/user-role.model';
import { SeedService } from '../../src/modules/seed/seed.service';
import { User } from '../../src/modules/users/models/user.model';

/**
 * Pruebas de integración de autenticación contra PostgreSQL real (ADR-0002):
 * cookies, CSRF, rotación, reutilización, recuperación y propiedad de recursos.
 */
describe('Auth y clientes (integración)', () => {
  let app: INestApplication;
  let appToken: string;
  let server: any;

  beforeAll(async () => {
    const nestApp = await NestFactory.create<NestExpressApplication>(
      AppModule,
      {
        logger: false,
      },
    );
    nestApp.use(cookieParser());
    nestApp.setGlobalPrefix('api/v1');
    await nestApp.init();
    app = nestApp;
    server = nestApp.getHttpServer();
    appToken = process.env.APP_ACCESS_TOKEN ?? '';

    await app.get(SeedService).run();
  });

  afterAll(async () => {
    await app.close();
  });

  function uniqueEmail(prefix: string): string {
    return `${prefix}.${randomUUID()}@tiendalujosa.test`;
  }

  async function register(
    email: string,
    password = 'PasswordSegura123',
  ): Promise<void> {
    await request(server)
      .post('/api/v1/auth/register')
      .set('x-app-token', appToken)
      .send({ name: 'Cliente Prueba', email, password })
      .expect(201);
  }

  function cookieValue(response: any, name: string): string {
    const cookies = (response.headers['set-cookie'] ??
      []) as unknown as string[];
    const cookie = cookies.find((value) => value.startsWith(`${name}=`));
    if (!cookie) {
      throw new Error(`No se encontró la cookie ${name}`);
    }
    return cookie.split(';')[0].slice(name.length + 1);
  }

  async function login(
    email: string,
    password = 'PasswordSegura123',
    agent?: any,
  ) {
    const client = agent ?? request.agent(server);
    const response = await client
      .post('/api/v1/auth/login')
      .set('x-app-token', appToken)
      .send({ email, password })
      .expect(200);
    return { client, response };
  }

  function csrfHeaders(response: any): Record<string, string> {
    return { 'x-csrf-token': cookieValue(response, 'tl_csrf') };
  }

  it('registra solo CUSTOMER y no devuelve tokens en el cuerpo (RF-AUT-001)', async () => {
    const email = uniqueEmail('registro');
    const response = await request(server)
      .post('/api/v1/auth/register')
      .set('x-app-token', appToken)
      .send({ name: 'Cliente Registro', email, password: 'PasswordSegura123' })
      .expect(201);

    expect(response.body).toEqual({
      message: expect.any(String),
    });

    const userModel = app.get<typeof User>(getModelToken(User));
    const user = await userModel.findOne({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.isStaff).toBe(false);

    const userRoleModel = app.get<typeof UserRole>(getModelToken(UserRole));
    const roleModel = app.get<typeof Role>(getModelToken(Role));
    const customer = await roleModel.findOne({ where: { code: 'CUSTOMER' } });
    expect(
      await userRoleModel.findOne({
        where: { userId: user!.id, roleId: customer!.id },
      }),
    ).not.toBeNull();
  });

  it('no revela si un correo ya está registrado (RF-AUT-004)', async () => {
    const email = uniqueEmail('duplicado');
    await register(email);

    const response = await request(server)
      .post('/api/v1/auth/register')
      .set('x-app-token', appToken)
      .send({ name: 'Otro Nombre', email, password: 'OtraPassword123' })
      .expect(201);

    expect(response.body).toEqual({ message: expect.any(String) });
  });

  it('inicia sesión con cookies httpOnly y exige CSRF en mutaciones', async () => {
    const email = uniqueEmail('csrf');
    await register(email);
    const { client, response } = await login(email);

    expect(response.body).toEqual({ user: expect.objectContaining({ email }) });
    expect(response.body).not.toHaveProperty('accessToken');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('tl_access='),
        expect.stringContaining('tl_refresh='),
        expect.stringContaining('tl_csrf='),
      ]),
    );
    expect(cookieValue(response, 'tl_access')).not.toBe('');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('HttpOnly')]),
    );

    await client
      .get('/api/v1/me')
      .set('x-app-token', appToken)
      .expect(200)
      .expect((res: request.Response) => expect(res.body.email).toBe(email));

    await client
      .patch('/api/v1/me')
      .set('x-app-token', appToken)
      .send({ name: 'Sin CSRF' })
      .expect(403)
      .expect((res: request.Response) =>
        expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID'),
      );

    await client
      .patch('/api/v1/me')
      .set('x-app-token', appToken)
      .set(csrfHeaders(response))
      .send({ name: 'Nombre Actualizado' })
      .expect(200)
      .expect((res: request.Response) =>
        expect(res.body.name).toBe('Nombre Actualizado'),
      );
  });

  it('rota el refresh y revoca la familia si se reutiliza (RF-AUT-002)', async () => {
    const email = uniqueEmail('refresh');
    await register(email);
    const { client, response: loginResponse } = await login(email);
    const oldRefresh = cookieValue(loginResponse, 'tl_refresh');
    const oldCsrf = cookieValue(loginResponse, 'tl_csrf');

    const refreshed = await client
      .post('/api/v1/auth/refresh')
      .set('x-app-token', appToken)
      .set('x-csrf-token', oldCsrf)
      .expect(200);
    const newRefresh = cookieValue(refreshed, 'tl_refresh');
    const newCsrf = cookieValue(refreshed, 'tl_csrf');
    expect(newRefresh).not.toBe(oldRefresh);

    await request(server)
      .post('/api/v1/auth/refresh')
      .set('x-app-token', appToken)
      .set('Cookie', [`tl_refresh=${oldRefresh}`, `tl_csrf=${oldCsrf}`])
      .set('x-csrf-token', oldCsrf)
      .expect(401)
      .expect((res: request.Response) =>
        expect(res.body.error.code).toBe('UNAUTHENTICATED'),
      );

    await request(server)
      .post('/api/v1/auth/refresh')
      .set('x-app-token', appToken)
      .set('Cookie', [`tl_refresh=${newRefresh}`, `tl_csrf=${newCsrf}`])
      .set('x-csrf-token', newCsrf)
      .expect(401);
  });

  it('una cuenta desactivada pierde acceso de inmediato', async () => {
    const email = uniqueEmail('disabled');
    await register(email);
    const { client } = await login(email);

    const userModel = app.get<typeof User>(getModelToken(User));
    await userModel.update({ status: 'DISABLED' }, { where: { email } });

    await client
      .get('/api/v1/me')
      .set('x-app-token', appToken)
      .expect(403)
      .expect((res: request.Response) =>
        expect(res.body.error.code).toBe('ACCOUNT_DISABLED'),
      );
  });

  it('completa recuperación con token de un solo uso (RF-AUT-003)', async () => {
    const email = uniqueEmail('reset');
    await register(email);
    const mail = app.get(AuthMailService);
    const sendSpy = jest
      .spyOn(mail, 'sendPasswordReset')
      .mockResolvedValue(undefined);

    await request(server)
      .post('/api/v1/auth/forgot-password')
      .set('x-app-token', appToken)
      .send({ email })
      .expect(200);

    const resetUrl = sendSpy.mock.calls[0][1];
    const token = new URL(resetUrl).searchParams.get('token');
    expect(token).toBeTruthy();

    await request(server)
      .post('/api/v1/auth/reset-password')
      .set('x-app-token', appToken)
      .send({ token, password: 'NuevaPassword456' })
      .expect(204);

    await request(server)
      .post('/api/v1/auth/login')
      .set('x-app-token', appToken)
      .send({ email, password: 'PasswordSegura123' })
      .expect(401)
      .expect((res: request.Response) =>
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS'),
      );

    await request(server)
      .post('/api/v1/auth/login')
      .set('x-app-token', appToken)
      .send({ email, password: 'NuevaPassword456' })
      .expect(200);

    await request(server)
      .post('/api/v1/auth/reset-password')
      .set('x-app-token', appToken)
      .send({ token, password: 'OtraPassword789' })
      .expect(400)
      .expect((res: request.Response) =>
        expect(res.body.error.code).toBe('INVALID_RESET_TOKEN'),
      );
  });

  it('responde genérico al recuperar un correo inexistente', async () => {
    const response = await request(server)
      .post('/api/v1/auth/forgot-password')
      .set('x-app-token', appToken)
      .send({ email: uniqueEmail('inexistente') })
      .expect(200);

    expect(response.body.message).toEqual(expect.any(String));
  });

  it('un cliente no puede leer ni modificar direcciones ajenas (RF-USR-001)', async () => {
    const ownerEmail = uniqueEmail('direccion-owner');
    const otherEmail = uniqueEmail('direccion-other');
    await register(ownerEmail);
    await register(otherEmail);

    const owner = await login(ownerEmail);
    const created = await owner.client
      .post('/api/v1/me/addresses')
      .set('x-app-token', appToken)
      .set(csrfHeaders(owner.response))
      .send({
        fullName: 'Cliente Propietario',
        line1: 'Calle Mayor 1',
        city: 'Madrid',
        region: 'Madrid',
        postalCode: '28001',
        countryCode: 'es',
        phone: '+34600111222',
      })
      .expect(201);

    expect(created.body.countryCode).toBe('ES');
    const addressId = created.body.id as string;

    const other = await login(otherEmail);
    await other.client
      .get('/api/v1/me/addresses')
      .set('x-app-token', appToken)
      .expect(200)
      .expect((res: request.Response) => expect(res.body).toEqual([]));

    await other.client
      .patch(`/api/v1/me/addresses/${addressId}`)
      .set('x-app-token', appToken)
      .set(csrfHeaders(other.response))
      .send({
        fullName: 'Intruso',
        line1: 'Calle Falsa 2',
        city: 'Madrid',
        region: 'Madrid',
        postalCode: '28002',
        countryCode: 'ES',
        phone: '+34600333444',
      })
      .expect(404);

    await other.client
      .delete(`/api/v1/me/addresses/${addressId}`)
      .set('x-app-token', appToken)
      .set(csrfHeaders(other.response))
      .expect(404);
  });

  it('cierra sesión y borra las cookies', async () => {
    const email = uniqueEmail('logout');
    await register(email);
    const { client, response } = await login(email);

    await client
      .post('/api/v1/auth/logout')
      .set('x-app-token', appToken)
      .set(csrfHeaders(response))
      .expect(204);

    await client.get('/api/v1/me').set('x-app-token', appToken).expect(401);
  });
});
