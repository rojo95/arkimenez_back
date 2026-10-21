import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppException } from '../../../shared/errors/app-exception';
import { ErrorCode } from '../../../shared/errors/error-codes';
import type { PermissionCode } from '../../roles-permissions/permissions.constants';
import { RolesPermissionsService } from '../../roles-permissions/roles-permissions.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesPermissionsService: RolesPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const required =
      this.reflector.getAllAndOverride<PermissionCode[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (isPublic || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'Se requiere iniciar sesión',
      );
    }

    const permissions =
      await this.rolesPermissionsService.getPermissionsForUser(user.id);
    user.permissions = permissions;

    const missing = required.filter(
      (permission) => !permissions.includes(permission),
    );
    if (missing.length > 0) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.FORBIDDEN,
        'No tienes permisos para esta operación',
      );
    }

    return true;
  }
}
