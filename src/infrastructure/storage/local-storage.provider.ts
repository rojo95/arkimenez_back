import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StorageProvider } from './storage.interface';

/**
 * Driver local, solo para desarrollo. Los archivos se sirven de forma pública
 * bajo `/media/`; en producción el arranque rechaza este driver.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = resolve(
      process.cwd(),
      config.get<string>('STORAGE_LOCAL_DIR') ?? './.uploads',
    );
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = join(this.baseDir, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.baseDir, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  getPublicUrl(key: string): string {
    return `/media/${key}`;
  }
}
