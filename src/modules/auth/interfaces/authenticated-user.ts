export interface AuthenticatedUser {
  id: string;
  email: string;
  permissions: string[];
}

export interface JwtPayload {
  sub: string;
  email: string;
}
