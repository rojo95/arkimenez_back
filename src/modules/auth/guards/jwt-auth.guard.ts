import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppException } from '../../../shared/errors/app-exception';
import { ErrorCode } from '../../../shared/errors/error-codes';
import { UsersService } from '../../users/users.service';
import { COOKIE_NAMES } from '../auth.constants';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/authenticated-user';

type RequestWithUser = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractToken(request);
    if (!token) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'Se requiere iniciar sesión',
      );
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'La sesión no es válida o ha expirado',
      );
    }

    if (!payload.sub) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'La sesión no es válida o ha expirado',
      );
    }

    // La cuenta se relee en cada petición: una baja debe surtir efecto inmediato.
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.UNAUTHENTICATED,
        'La sesión no es válida o ha expirado',
      );
    }
    if (user.status === 'DISABLED') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_DISABLED,
        'La cuenta está desactivada',
      );
    }

    request.user = {
      id: user.id,
      email: user.email,
      permissions: [],
    };

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }

    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[COOKIE_NAMES.accessToken];
  }
}
