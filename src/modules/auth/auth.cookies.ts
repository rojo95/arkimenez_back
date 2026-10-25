import type { CookieOptions, Response } from 'express';
import type { ConfigService } from '@nestjs/config';
import { COOKIE_NAMES, REFRESH_COOKIE_PATH } from './auth.constants';
import type { SessionResult } from './auth.types';

function baseOptions(config: ConfigService): CookieOptions {
  const domain = config.get<string>('COOKIE_DOMAIN')?.trim();
  return {
    sameSite: 'lax',
    secure: config.get<boolean>('COOKIE_SECURE') ?? false,
    ...(domain ? { domain } : {}),
  };
}

/** Escribe las tres cookies de sesión (ADR-0002). */
export function setSessionCookies(
  response: Response,
  session: SessionResult,
  config: ConfigService,
): void {
  const base = baseOptions(config);

  response.cookie(COOKIE_NAMES.accessToken, session.accessToken, {
    ...base,
    httpOnly: true,
    path: '/',
    maxAge: session.accessMaxAgeMs,
  });
  response.cookie(COOKIE_NAMES.refreshToken, session.refreshToken, {
    ...base,
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
    maxAge: session.refreshMaxAgeMs,
  });
  response.cookie(COOKIE_NAMES.csrfToken, session.csrfToken, {
    ...base,
    httpOnly: false,
    path: '/',
    maxAge: session.refreshMaxAgeMs,
  });
}

/** Borra las cookies con el mismo path con el que se crearon. */
export function clearSessionCookies(
  response: Response,
  config: ConfigService,
): void {
  const base = baseOptions(config);

  response.clearCookie(COOKIE_NAMES.accessToken, {
    ...base,
    httpOnly: true,
    path: '/',
  });
  response.clearCookie(COOKIE_NAMES.refreshToken, {
    ...base,
    httpOnly: true,
    path: REFRESH_COOKIE_PATH,
  });
  response.clearCookie(COOKIE_NAMES.csrfToken, {
    ...base,
    httpOnly: false,
    path: '/',
  });
}
