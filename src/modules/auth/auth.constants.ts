/** Nombres de cookie y cabeceras de sesión (ADR-0002). */
export const COOKIE_NAMES = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  csrfToken: 'csrf_token',
} as const;

export const CSRF_HEADER = 'x-csrf-token';

/** Métodos que no modifican estado y quedan exentos de CSRF. */
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
