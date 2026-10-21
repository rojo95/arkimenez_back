import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../../shared/errors/app-exception';
import { JwtAuthGuard } from './jwt-auth.guard';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let jwtService: { verifyAsync: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    jwtService = { verifyAsync: jest.fn() };
    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
    );
  });

  it('permite el paso de rutas públicas sin token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rechaza con 401 si no hay token', async () => {
    await expect(
      guard.canActivate(buildContext({ headers: {} })),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('acepta un token válido del encabezado Authorization', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'a@b.com' });
    const request: Record<string, unknown> = {
      headers: { authorization: 'Bearer valido' },
    };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      permissions: [],
    });
  });

  it('rechaza con 401 un token inválido', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));

    await expect(
      guard.canActivate(
        buildContext({ headers: { authorization: 'Bearer malo' } }),
      ),
    ).rejects.toBeInstanceOf(AppException);
  });

  it('lee la cookie access_token', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'a@b.com' });

    await expect(
      guard.canActivate(
        buildContext({ headers: {}, cookies: { access_token: 'valido' } }),
      ),
    ).resolves.toBe(true);
  });

  it('el error es un AppException con estado 401', async () => {
    try {
      await guard.canActivate(buildContext({ headers: {} }));
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
  });
});
