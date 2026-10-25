import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AppException } from '../../../shared/errors/app-exception';
import { ErrorCode } from '../../../shared/errors/error-codes';
import { secureEquals } from '../../../shared/utils/secure-compare';
import { COOKIE_NAMES, CSRF_HEADER, SAFE_METHODS } from '../auth.constants';

/**
 * Protección CSRF por doble envío: la cookie `tl_csrf` (legible por el
 * frontend) debe coincidir con la cabecera `X-CSRF-Token`.
 *
 * Solo se exige en peticiones que modifican estado y cuando ya existe una
 * sesión (cookies de sesión). El login, que aún no tiene cookies, queda fuera.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      return true;
    }

    const cookies = request.cookies as Record<string, string> | undefined;
    const hasSession =
      cookies?.[COOKIE_NAMES.accessToken] ||
      cookies?.[COOKIE_NAMES.refreshToken];
    if (!hasSession) {
      return true;
    }

    const csrfCookie = cookies?.[COOKIE_NAMES.csrfToken];
    const csrfHeader = request.headers[CSRF_HEADER];

    if (
      typeof csrfCookie !== 'string' ||
      typeof csrfHeader !== 'string' ||
      csrfCookie.length === 0 ||
      !secureEquals(csrfCookie, csrfHeader)
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.CSRF_TOKEN_INVALID,
        'La verificación CSRF ha fallado',
      );
    }

    return true;
  }
}
