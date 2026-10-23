import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

const API_PREFIX = 'api/v1';
const DOCS_PATH = `${API_PREFIX}/docs`;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);

  if (config.get<string>('STORAGE_DRIVER') === 'local') {
    app.useStaticAssets(
      resolve(
        process.cwd(),
        config.get<string>('STORAGE_LOCAL_DIR') ?? './.uploads',
      ),
      { prefix: '/media/' },
    );
  }
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });

  if (config.get<string>('NODE_ENV') !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('tiendaLujosa API')
        .setDescription('API REST de la tienda (SDD §9)')
        .setVersion('1.0')
        .build(),
    );
    SwaggerModule.setup(DOCS_PATH, app, document);
  }

  await app.listen(config.get<number>('PORT') ?? 3001);
}

void bootstrap();
