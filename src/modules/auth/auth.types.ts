import type { PublicUser } from '../users/users.types';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface SessionResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}
