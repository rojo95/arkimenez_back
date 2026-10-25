import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { UniqueConstraintError, type Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import { durationToMs } from '../../shared/utils/duration';
import { normalizeEmail } from '../../shared/utils/email';
import { AuditService } from '../audit/audit.service';
import { PasswordHasher } from '../users/password-hasher';
import type { User } from '../users/models/user.model';
import { UsersService } from '../users/users.service';
import { AuthMailService } from './auth.mail';
import { PasswordResetToken } from './models/password-reset-token.model';
import { RefreshToken } from './models/refresh-token.model';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SessionResult,
} from './auth.types';

export const REGISTER_RESPONSE_MESSAGE =
  'Si el correo puede registrarse, la cuenta estará disponible para iniciar sesión.';
export const FORGOT_RESPONSE_MESSAGE =
  'Si el correo pertenece a una cuenta, recibirás un enlace de recuperación.';

interface PersistedRefresh {
  raw: string;
  record: RefreshToken;
}

type RefreshOutcome =
  | { kind: 'ok'; user: User; raw: string }
  | { kind: 'invalid' | 'reused' | 'expired' | 'disabled' };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessMaxAgeMs: number;
  private readonly refreshMaxAgeMs: number;
  private readonly resetTtlMs: number;
  private readonly frontendUrl: string;
  private readonly defaultLocale: string;

  constructor(
    private readonly config: ConfigService,
    private readonly sequelize: Sequelize,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly mailService: AuthMailService,
    private readonly auditService: AuditService,
    @InjectModel(RefreshToken)
    private readonly refreshTokenModel: typeof RefreshToken,
    @InjectModel(PasswordResetToken)
    private readonly passwordResetModel: typeof PasswordResetToken,
  ) {
    this.accessMaxAgeMs = durationToMs(
      config.get<string>('ACCESS_TOKEN_TTL') ?? '15m',
    );
    this.refreshMaxAgeMs =
      (config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 30) * 86_400_000;
    this.resetTtlMs =
      (config.get<number>('PASSWORD_RESET_TTL_MINUTES') ?? 60) * 60_000;
    this.frontendUrl = (
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
    this.defaultLocale = config.get<string>('DEFAULT_LOCALE') ?? 'es';
  }

  /**
   * Registro público. La respuesta es genérica exista o no el correo
   * (RF-AUT-001, RF-AUT-004).
   */
  async register(input: RegisterInput): Promise<void> {
    const passwordHash = await this.passwordHasher.hash(input.password);
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      return;
    }

    try {
      const user = await this.usersService.createCustomer({
        name: input.name,
        email: input.email,
        passwordHash,
      });
      await this.auditService.record({
        actorId: user.id,
        action: 'auth.register',
        entity: 'user',
        entityId: user.id,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        return;
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<SessionResult> {
    const user = await this.usersService.findByEmail(input.email);

    if (!user) {
      // Mantiene un coste similar al de una verificación real.
      await this.passwordHasher.hash(input.password);
      throw this.invalidCredentials();
    }

    const valid = await this.passwordHasher.verify(
      user.passwordHash,
      input.password,
    );
    if (!valid) {
      throw this.invalidCredentials();
    }

    if (user.status === 'DISABLED') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_DISABLED,
        'La cuenta está desactivada',
      );
    }

    return this.createSession(user);
  }

  /**
   * Rotación de refresh token. Si se reutiliza uno ya rotado se revoca toda
   * su familia (ADR-0002).
   */
  async refresh(rawRefresh: string | undefined): Promise<SessionResult> {
    if (!rawRefresh) {
      throw this.invalidSession();
    }

    const outcome = await this.sequelize.transaction<RefreshOutcome>(
      async (transaction) => {
        const current = await this.refreshTokenModel.findOne({
          where: { tokenHash: this.hashToken(rawRefresh) },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!current) {
          return { kind: 'invalid' } as const;
        }

        if (current.revokedAt || current.replacedBy) {
          await this.revokeFamily(current.familyId, transaction);
          return { kind: 'reused' } as const;
        }

        if (current.expiresAt.getTime() <= Date.now()) {
          current.revokedAt = new Date();
          await current.save({ transaction });
          return { kind: 'expired' } as const;
        }

        const user = await this.usersService.findById(
          current.userId,
          transaction,
        );
        if (!user) {
          await this.revokeFamily(current.familyId, transaction);
          return { kind: 'invalid' } as const;
        }
        if (user.status === 'DISABLED') {
          await this.revokeFamily(current.familyId, transaction);
          return { kind: 'disabled' } as const;
        }

        const next = await this.persistRefresh(
          user.id,
          current.familyId,
          transaction,
        );
        current.revokedAt = new Date();
        current.replacedBy = next.record.id;
        await current.save({ transaction });

        return { kind: 'ok', user, raw: next.raw } as const;
      },
    );

    if (outcome.kind === 'disabled') {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.ACCOUNT_DISABLED,
        'La cuenta está desactivada',
      );
    }
    if (outcome.kind !== 'ok') {
      throw this.invalidSession();
    }

    return this.buildSession(outcome.user, outcome.raw);
  }

  async logout(rawRefresh: string | undefined): Promise<void> {
    if (!rawRefresh) {
      return;
    }

    await this.refreshTokenModel.update(
      { revokedAt: new Date() },
      {
        where: {
          tokenHash: this.hashToken(rawRefresh),
          revokedAt: null,
        },
      },
    );
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw this.invalidSession();
    }

    const valid = await this.passwordHasher.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) {
      throw this.invalidCredentials();
    }

    const newHash = await this.passwordHasher.hash(input.newPassword);
    await this.sequelize.transaction(async (transaction) => {
      user.passwordHash = newHash;
      await user.save({ transaction });
      await this.revokeAllForUser(user.id, transaction);
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'auth.change_password',
      entity: 'user',
      entityId: user.id,
    });
  }

  /** Responde siempre igual para no revelar si la cuenta existe. */
  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await this.usersService.findByEmail(input.email);
    if (!user || user.status === 'DISABLED') {
      return;
    }

    const raw = this.generateOpaqueToken();
    const now = new Date();
    await this.sequelize.transaction(async (transaction) => {
      await this.passwordResetModel.update(
        { usedAt: now },
        {
          where: { userId: user.id, usedAt: null },
          transaction,
        },
      );
      await this.passwordResetModel.create(
        {
          userId: user.id,
          tokenHash: this.hashToken(raw),
          expiresAt: new Date(now.getTime() + this.resetTtlMs),
        },
        { transaction },
      );
    });

    const resetUrl = `${this.frontendUrl}/${encodeURIComponent(
      this.defaultLocale,
    )}/reset-password?token=${encodeURIComponent(raw)}`;

    try {
      await this.mailService.sendPasswordReset(
        normalizeEmail(user.email),
        resetUrl,
      );
    } catch {
      // No se registra el token ni el correo. El mensaje al cliente sigue siendo genérico.
      this.logger.warn(
        `No se pudo enviar el correo de recuperación (userId=${user.id})`,
      );
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const newHash = await this.passwordHasher.hash(input.password);
    const tokenHash = this.hashToken(input.token);

    const reset = await this.sequelize.transaction(async (transaction) => {
      const record = await this.passwordResetModel.findOne({
        where: { tokenHash },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (
        !record ||
        record.usedAt ||
        record.expiresAt.getTime() <= Date.now()
      ) {
        return null;
      }

      const user = await this.usersService.findById(record.userId, transaction);
      if (!user || user.status === 'DISABLED') {
        return null;
      }

      user.passwordHash = newHash;
      await user.save({ transaction });
      await this.passwordResetModel.update(
        { usedAt: new Date() },
        { where: { userId: user.id, usedAt: null }, transaction },
      );
      await this.revokeAllForUser(user.id, transaction);

      return user;
    });

    if (!reset) {
      throw new AppException(
        HttpStatus.BAD_REQUEST,
        ErrorCode.INVALID_RESET_TOKEN,
        'El enlace de recuperación no es válido o ha caducado',
      );
    }

    await this.auditService.record({
      actorId: reset.id,
      action: 'auth.reset_password',
      entity: 'user',
      entityId: reset.id,
    });
  }

  private async createSession(user: User): Promise<SessionResult> {
    const persisted = await this.persistRefresh(user.id, randomUUID());
    return this.buildSession(user, persisted.raw);
  }

  private async buildSession(
    user: User,
    refreshToken: string,
  ): Promise<SessionResult> {
    const accessToken = await this.jwtService.signAsync({ sub: user.id });

    return {
      user: this.usersService.toPublicUser(user),
      accessToken,
      refreshToken,
      csrfToken: this.generateOpaqueToken(),
      accessMaxAgeMs: this.accessMaxAgeMs,
      refreshMaxAgeMs: this.refreshMaxAgeMs,
    };
  }

  private async persistRefresh(
    userId: string,
    familyId: string,
    transaction?: Transaction,
  ): Promise<PersistedRefresh> {
    const raw = this.generateOpaqueToken();
    const record = await this.refreshTokenModel.create(
      {
        userId,
        familyId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + this.refreshMaxAgeMs),
      },
      { transaction },
    );

    return { raw, record };
  }

  private async revokeFamily(
    familyId: string,
    transaction: Transaction,
  ): Promise<void> {
    await this.refreshTokenModel.update(
      { revokedAt: new Date() },
      { where: { familyId, revokedAt: null }, transaction },
    );
  }

  private async revokeAllForUser(
    userId: string,
    transaction: Transaction,
  ): Promise<void> {
    await this.refreshTokenModel.update(
      { revokedAt: new Date() },
      { where: { userId, revokedAt: null }, transaction },
    );
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private invalidCredentials(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.INVALID_CREDENTIALS,
      'Correo o contraseña incorrectos',
    );
  }

  private invalidSession(): AppException {
    return new AppException(
      HttpStatus.UNAUTHORIZED,
      ErrorCode.UNAUTHENTICATED,
      'La sesión no es válida o ha expirado',
    );
  }
}
