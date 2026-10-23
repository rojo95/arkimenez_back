import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { STORAGE_PROVIDER } from './storage.interface';
import type { StorageProvider } from './storage.interface';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): StorageProvider => {
        const driver = config.getOrThrow<string>('STORAGE_DRIVER');

        if (driver === 's3') {
          return new S3StorageProvider(config);
        }

        if (config.get<string>('NODE_ENV') === 'production') {
          throw new Error(
            'STORAGE_DRIVER=local no está permitido en producción (ADR-0004)',
          );
        }

        return new LocalStorageProvider(config);
      },
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
