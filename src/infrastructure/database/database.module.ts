import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import type { SequelizeModuleOptions } from '@nestjs/sequelize';

/**
 * Conexión a PostgreSQL mediante Sequelize (ADR-0001).
 *
 * Usa el mismo patrón de variables DB_* que SmartBucks. En la Fase 1 no hay
 * modelos de negocio: la lista `models` queda vacía y el esquema se gestionará
 * solo con migraciones versionadas (Fase 2). `sync()` está prohibido.
 */
@Global()
@Module({
  imports: [
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): SequelizeModuleOptions => ({
        dialect: 'postgres',
        host: config.getOrThrow<string>('DB_HOST'),
        port: config.getOrThrow<number>('DB_PORT'),
        database: config.getOrThrow<string>('DB_NAME'),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD') ?? '',
        autoLoadModels: true,
        models: [],
        logging: false,
        dialectOptions: config.get<boolean>('DB_SSL')
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
      }),
    }),
  ],
  exports: [SequelizeModule],
})
export class DatabaseModule {}
