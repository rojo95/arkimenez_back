import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { SequelizeModule } from '@nestjs/sequelize';
import type { SignOptions } from 'jsonwebtoken';
import { AuditModule } from '../audit/audit.module';
import { RolesPermissionsModule } from '../roles-permissions/roles-permissions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthMailService } from './auth.mail';
import { AuthService } from './auth.service';
import { CsrfGuard } from './guards/csrf.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PasswordResetToken } from './models/password-reset-token.model';
import { RefreshToken } from './models/refresh-token.model';

/**
 * Sesiones y autorización (ADR-0002).
 *
 * Guardas globales en orden: CSRF → sesión → permisos. El registro público
 * solo crea CUSTOMER; las cuentas de personal llegan en la Fase 7.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>(
            'ACCESS_TOKEN_TTL',
          ) as SignOptions['expiresIn'],
        },
      }),
    }),
    SequelizeModule.forFeature([RefreshToken, PasswordResetToken]),
    UsersModule,
    RolesPermissionsModule,
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthMailService,
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
