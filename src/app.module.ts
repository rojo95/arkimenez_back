import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HealthModule } from './modules/health/health.module';
import { AppTokenMiddleware } from './shared/middleware/app-token/app-token.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Toda la API exige la clave compartida con el frontend (x-app-token).
    consumer
      .apply(AppTokenMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
