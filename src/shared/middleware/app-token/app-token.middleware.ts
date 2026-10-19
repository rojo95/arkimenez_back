import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const APP_TOKEN_HEADER = 'x-app-token';

function secureEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  // timingSafeEqual exige longitudes iguales; si no, no hay coincidencia.
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Exige la cabecera `x-app-token` con el valor de APP_ACCESS_TOKEN.
 *
 * Es el equivalente Nest del middleware `ensureAccessFromApp` de SmartBucks:
 * filtra clientes que no son el frontend autorizado. No sustituye a la
 * autenticación de usuarios (JWT/cookies), que llega en fases posteriores.
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

    const provided = req.headers[APP_TOKEN_HEADER];
    const expected = this.config.getOrThrow<string>('APP_ACCESS_TOKEN');

    if (typeof provided !== 'string' || !secureEquals(provided, expected)) {
      res.status(401).json({
        error: {
          code: 'APP_TOKEN_REQUIRED',
          message: 'Acceso no autorizado',
          details: [],
          traceId: 'app-token',
        },
      });
      return;
    }

    next();
  }
}
