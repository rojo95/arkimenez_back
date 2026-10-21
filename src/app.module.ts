import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { RolesPermissionsModule } from './modules/roles-permissions/roles-permissions.module';
import { StoreSettingsModule } from './modules/store-settings/store-settings.module';
import { UsersModule } from './modules/users/users.module';
import { AllExceptionsFilter } from './shared/errors/all-exceptions.filter';
import { AppTokenMiddleware } from './shared/middleware/app-token/app-token.middleware';
import { TraceIdMiddleware } from './shared/middleware/trace-id/trace-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    DatabaseModule,
    UsersModule,
    RolesPermissionsModule,
    StoreSettingsModule,
    AuditModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // El traceId se asigna primero; después se exige la clave compartida con el
    // frontend (x-app-token) en toda la API.
    consumer
      .apply(TraceIdMiddleware, AppTokenMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
