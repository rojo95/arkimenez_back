import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { getTraceId } from '../../context/request-context';
import { ErrorCode } from '../../errors/error-codes';
import { secureEquals } from '../../utils/secure-compare';

const APP_TOKEN_HEADER = 'x-app-token';
const DOCS_PATH_PREFIX = '/api/v1/docs';
const MEDIA_PATH_PREFIX = '/media/';

/**
 * Exige la cabecera `x-app-token` con el valor de APP_ACCESS_TOKEN.
 *
 * Es el equivalente Nest del middleware `ensureAccessFromApp` de SmartBucks:
 * filtra clientes que no son el frontend autorizado. No sustituye a la
 * autenticación de usuarios (JWT/cookies).
 *
 * Quedan fuera la documentación OpenAPI (`/api/v1/docs`), porque su UI no
 * envía cabeceras personalizadas, y los archivos servidos en `/media/`
 * (imágenes locales de desarrollo, ADR-0004).
 */
@Injectable()
export class AppTokenMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Los preflight CORS no llevan cabeceras personalizadas.
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    // Las imágenes locales se sirven como assets estáticos (ADR-0004).
    if (
      req.originalUrl.startsWith(DOCS_PATH_PREFIX) ||
      req.originalUrl.startsWith(MEDIA_PATH_PREFIX)
    ) {
      next();
      return;
    }

    const provided = req.headers[APP_TOKEN_HEADER];
    const expected = this.config.getOrThrow<string>('APP_ACCESS_TOKEN');

    if (typeof provided !== 'string' || !secureEquals(provided, expected)) {
      res.status(401).json({
        error: {
          code: ErrorCode.APP_TOKEN_REQUIRED,
          message: 'Acceso no autorizado',
          details: [],
          traceId: getTraceId() ?? 'unknown',
        },
      });
      return;
    }

    next();
  }
}
