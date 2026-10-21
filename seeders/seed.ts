import { NestFactory } from '@nestjs/core';
import { SeedModule } from '../src/modules/seed/seed.module';
import { SeedService } from '../src/modules/seed/seed.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule);

  try {
    await app.get(SeedService).run();
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
