import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { AppTokenMiddleware } from './app-token.middleware';

const TOKEN = 'tl_test_token_de_al_menos_16_caracteres';

function createMiddleware(): AppTokenMiddleware {
  const config = {
    getOrThrow: jest.fn().mockReturnValue(TOKEN),
  } as unknown as ConfigService;

  return new AppTokenMiddleware(config);
}

function createResponse(): Response {
  const response = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return response as unknown as Response;
}

describe('AppTokenMiddleware', () => {
  it('permite la petición con una clave válida', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      headers: { 'x-app-token': TOKEN },
    } as unknown as Request;

    middleware.use(req, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 401 si falta la cabecera', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as NextFunction;
    const res = createResponse();
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      headers: {},
    } as unknown as Request;

    middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'APP_TOKEN_REQUIRED' }),
      }),
    );
  });

  it('deja pasar la documentación OpenAPI sin clave', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/docs',
      headers: {},
    } as unknown as Request;

    middleware.use(req, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 401 si la clave es incorrecta', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as NextFunction;
    const res = createResponse();
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/health',
      headers: { 'x-app-token': 'clave-incorrecta' },
    } as unknown as Request;

    middleware.use(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('deja pasar los preflight OPTIONS sin clave', () => {
    const middleware = createMiddleware();
    const next = jest.fn() as NextFunction;
    const req = {
      method: 'OPTIONS',
      originalUrl: '/api/v1/health',
      headers: {},
    } as unknown as Request;

    middleware.use(req, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
