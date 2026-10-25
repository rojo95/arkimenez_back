/** Nombres de cookie y cabeceras de sesión (ADR-0002). */
export const COOKIE_NAMES = {
  accessToken: 'tl_access',
  refreshToken: 'tl_refresh',
  csrfToken: 'tl_csrf',
} as const;

export const CSRF_HEADER = 'x-csrf-token';

/** Ruta de la cookie de refresh: solo se envía a los endpoints de auth. */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

/** Métodos que no modifican estado y quedan exentos de CSRF. */
export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
