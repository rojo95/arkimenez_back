export interface AuthenticatedUser {
  id: string;
  email: string;
  permissions: string[];
}

/** El access token solo identifica al usuario; roles y permisos se leen de BD. */
export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
}
