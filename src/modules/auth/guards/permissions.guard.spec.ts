import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../../shared/errors/app-exception';
import { RolesPermissionsService } from '../../roles-permissions/roles-permissions.service';
import { PermissionsGuard } from './permissions.guard';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let service: { getPermissionsForUser: jest.Mock };
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    service = { getPermissionsForUser: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      service as unknown as RolesPermissionsService,
    );
  });

  it('permite la ruta si no se exige ningún permiso', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce([]);

    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
  });

  it('permite si el usuario tiene todos los permisos', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['order:read']);
    service.getPermissionsForUser.mockResolvedValue([
      'order:read',
      'inventory:read',
    ]);

    await expect(
      guard.canActivate(buildContext({ user: { id: 'u1', permissions: [] } })),
    ).resolves.toBe(true);
  });

  it('responde 403 si falta algún permiso', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['settings:write']);
    service.getPermissionsForUser.mockResolvedValue(['order:read']);

    await expect(
      guard.canActivate(buildContext({ user: { id: 'u1', permissions: [] } })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('responde 401 si no hay usuario en la petición', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['order:read']);

    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(
      AppException,
    );
  });
});
