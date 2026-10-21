import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

const API_PREFIX = 'api/v1';
const DOCS_PATH = `${API_PREFIX}/docs`;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(cookieParser());
  app.setGlobalPrefix(API_PREFIX);
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
