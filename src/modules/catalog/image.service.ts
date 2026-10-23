import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import {
  STORAGE_PROVIDER,
  type StorageProvider,
} from '../../infrastructure/storage/storage.interface';
import { AppException } from '../../shared/errors/app-exception';
import { ErrorCode } from '../../shared/errors/error-codes';
import {
  ALLOWED_IMAGE_FORMATS,
  IMAGE_SIZES,
  OUTPUT_IMAGE_MIME,
} from './image.constants';

export interface ProcessedImage {
  storageKey: string;
  mime: string;
  sizeBytes: number;
}

/**
 * Valida y procesa imágenes de producto (ADR-0004).
 *
 * Verifica el contenido real con `sharp` (no la extensión), re-codifica a WebP
 * sin metadatos y genera thumb/medium/large. El nombre siempre lo genera el
 * servidor.
 */
@Injectable()
export class ImageService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly config: ConfigService,
  ) {}

  async processUpload(
    productId: string,
    file: Express.Multer.File,
  ): Promise<ProcessedImage> {
    const maxBytes =
      (this.config.get<number>('MAX_IMAGE_SIZE_MB') ?? 5) * 1024 * 1024;

    if (!file?.buffer || file.buffer.length === 0 || file.size > maxBytes) {
      throw this.invalidImage('size');
    }

    let format: string | undefined;
    try {
      const metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
      format = metadata.format;
    } catch {
      throw this.invalidImage('content');
    }

    if (!format || !ALLOWED_IMAGE_FORMATS.has(format)) {
      throw this.invalidImage('format');
    }

    const baseKey = `products/${productId}/${randomUUID()}`;
    const variants: Array<{ key: string; data: Buffer }> = [];

    // El procesado (contenido) y el almacenamiento (infraestructura) se
    // separan: un fallo de disco/S3 no debe responder "imagen inválida".
    try {
      for (const size of IMAGE_SIZES) {
        const data = await sharp(file.buffer, { failOn: 'error' })
          .rotate()
          .resize({ width: size.width, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer();

        variants.push({ key: `${baseKey}-${size.name}.webp`, data });
      }
    } catch {
      throw this.invalidImage('processing');
    }

    try {
      for (const variant of variants) {
        await this.storage.put(variant.key, variant.data, OUTPUT_IMAGE_MIME);
      }
    } catch (error) {
      await Promise.allSettled(
        variants.map((variant) => this.storage.delete(variant.key)),
      );
      throw error;
    }

    const large = variants.find((variant) =>
      variant.key.endsWith('-large.webp'),
    );

    return {
      storageKey: baseKey,
      mime: OUTPUT_IMAGE_MIME,
      sizeBytes: large?.data.length ?? 0,
    };
  }

  async deleteImage(storageKey: string): Promise<void> {
    await Promise.allSettled(
      IMAGE_SIZES.map((size) =>
        this.storage.delete(`${storageKey}-${size.name}.webp`),
      ),
    );
  }

  publicUrl(storageKey: string): string {
    return this.storage.getPublicUrl(storageKey);
  }

  toPublicUrls(storageKey: string): Record<string, string> {
    return Object.fromEntries(
      IMAGE_SIZES.map((size) => [
        size.name,
        this.storage.getPublicUrl(`${storageKey}-${size.name}.webp`),
      ]),
    );
  }

  private invalidImage(issue: string): AppException {
    return new AppException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      ErrorCode.INVALID_IMAGE,
      'La imagen no es válida',
      [{ field: 'image', issue }],
    );
  }
}
