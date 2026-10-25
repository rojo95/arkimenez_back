import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizeEmail } from '../utils/email';

/**
 * Límite por IP y, cuando el cuerpo trae `email`, también por correo
 * normalizado (RF-AUT-004). Los endpoints de auth tienen límites más estrictos
 * con `@Throttle`.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    request: Record<string, any>,
  ): Promise<string> {
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown';
    const email =
      typeof request.body?.email === 'string'
        ? normalizeEmail(request.body.email)
        : '';

    return email ? `${ip}:${email}` : ip;
  }
}
