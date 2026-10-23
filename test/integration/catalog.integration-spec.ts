import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { Sequelize } from 'sequelize-typescript';
import { AppModule } from '../../src/app.module';
import { AuditLog } from '../../src/modules/audit/models/audit-log.model';
import { CatalogService } from '../../src/modules/catalog/catalog.service';
import { ImageService } from '../../src/modules/catalog/image.service';
import { InventoryService } from '../../src/modules/inventory/inventory.service';
import { InventoryItem } from '../../src/modules/inventory/models/inventory-item.model';
import { StoreSetting } from '../../src/modules/store-settings/models/store-setting.model';
import { AppException } from '../../src/shared/errors/app-exception';

describe('Catálogo e inventario en PostgreSQL (integración)', () => {
  let app: INestApplicationContext;
  let sequelize: Sequelize;
  let catalog: CatalogService;
  let inventory: InventoryService;
  let imageService: ImageService;
  let actorId: string;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    sequelize = app.get(Sequelize);
    catalog = app.get(CatalogService);
    inventory = app.get(InventoryService);
    imageService = app.get(ImageService);

    const settings = app.get<typeof StoreSetting>(getModelToken(StoreSetting));
    for (const [key, value] of Object.entries({
      'i18n.locale.default': 'es',
      'i18n.locale.es.active': 'true',
      'i18n.locale.en.active': 'true',
    })) {
      await settings.findOrCreate({ where: { key }, defaults: { key, value } });
    }

    actorId = randomUUID();
    const now = new Date();
    await sequelize.getQueryInterface().bulkInsert('users', [
      {
        id: actorId,
        name: 'Operador de prueba',
        email: `inventory.${randomUUID()}@tiendalujosa.test`,
        password_hash: 'hash',
        status: 'ACTIVE',
        is_staff: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  function pngFile(): Promise<Express.Multer.File> {
    return sharp({
      create: {
        width: 12,
        height: 12,
        channels: 3,
        background: { r: 200, g: 180, b: 160 },
      },
    })
      .png()
      .toBuffer()
      .then(
        (buffer) =>
          ({
            buffer,
            size: buffer.length,
            mimetype: 'image/png',
            originalname: 'producto.png',
          }) as Express.Multer.File,
      );
  }

  async function createSimpleProduct(suffix: string, stock = 3) {
    return catalog.createProduct({
      type: 'SIMPLE',
      basePriceMinor: 2500,
      translations: [{ locale: 'es', name: `Camisa ${suffix}` }],
      variants: [{ sku: `SKU-${suffix}`, initialStock: stock }],
    });
  }

  it('exige imágenes y traducción por defecto para publicar (RN-CAT-01, RN-CAT-05)', async () => {
    const product = await createSimpleProduct(
      `sin-imagen-${randomUUID().slice(0, 8)}`,
    );

    await expect(
      catalog.changeStatus(product.id, 'PUBLISHED'),
    ).rejects.toMatchObject({ code: 'PRODUCT_IMAGE_REQUIRED' });

    await catalog.addImage(product.id, await pngFile(), 'Camisa');

    const onlyEnglish = await catalog.createProduct({
      type: 'SIMPLE',
      basePriceMinor: 3000,
      translations: [
        { locale: 'en', name: `Shirt ${randomUUID().slice(0, 8)}` },
      ],
      variants: [{ sku: `SKU-EN-${randomUUID().slice(0, 8)}` }],
    });
    await catalog.addImage(onlyEnglish.id, await pngFile(), 'Shirt');

    await expect(
      catalog.changeStatus(onlyEnglish.id, 'PUBLISHED'),
    ).rejects.toMatchObject({ code: 'PRODUCT_DEFAULT_TRANSLATION_REQUIRED' });

    await catalog.changeStatus(product.id, 'PUBLISHED');
    expect((await catalog.getAdminProduct(product.id)).status).toBe(
      'PUBLISHED',
    );
  });

  it('exige una variante activa en productos VARIABLE (RN-CAT-02)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const product = await catalog.createProduct({
      type: 'VARIABLE',
      basePriceMinor: 4000,
      translations: [{ locale: 'es', name: `Pantalón ${suffix}` }],
    });
    await catalog.addImage(product.id, await pngFile(), 'Pantalón');

    await expect(
      catalog.changeStatus(product.id, 'PUBLISHED'),
    ).rejects.toMatchObject({ code: 'PRODUCT_VARIANT_REQUIRED' });
  });

  it('no expone borradores y conserva archivados (RN-CAT-03, RN-CAT-04)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const product = await createSimpleProduct(`borrador-${suffix}`);

    const draftList = await catalog.listPublicProducts(
      {
        page: 1,
        pageSize: 100,
        sort: 'newest',
      },
      undefined,
    );
    expect(draftList.items.map((item) => item.id)).not.toContain(product.id);

    await expect(
      catalog.getPublicProduct(product.id, 'es', undefined),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await catalog.addImage(product.id, await pngFile(), 'Camisa');
    await catalog.changeStatus(product.id, 'PUBLISHED');
    await catalog.changeStatus(product.id, 'ARCHIVED');

    expect((await catalog.getAdminProduct(product.id)).status).toBe('ARCHIVED');
    await expect(
      catalog.getPublicProduct(product.id, 'es', undefined),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('impone unicidad de slug por idioma', async () => {
    const slug = `slug-unico-${randomUUID().slice(0, 8)}`;
    await catalog.createProduct({
      type: 'SIMPLE',
      basePriceMinor: 1000,
      translations: [{ locale: 'es', name: 'Producto A', slug }],
    });

    await expect(
      catalog.createProduct({
        type: 'SIMPLE',
        basePriceMinor: 1000,
        translations: [{ locale: 'es', name: 'Producto B', slug }],
      }),
    ).rejects.toMatchObject({ code: 'SLUG_ALREADY_EXISTS' });
  });

  it('rechaza combinaciones de variantes duplicadas (RF-CAT-002)', async () => {
    const suffix = randomUUID().slice(0, 8);
    const attribute = await catalog.createAttribute({
      code: `talla_${suffix}`,
      isVariantAxis: true,
      translations: [{ locale: 'es', name: 'Talla' }],
    });
    const value = await catalog.createAttributeValue(attribute!.id, {
      code: 'M',
      translations: [{ locale: 'es', name: 'M' }],
    });

    await expect(
      catalog.createProduct({
        type: 'VARIABLE',
        basePriceMinor: 3500,
        translations: [{ locale: 'es', name: `Camiseta ${suffix}` }],
        variants: [
          {
            sku: `VAR-A-${suffix}`,
            optionValueIds: [value!.id],
          },
          {
            sku: `VAR-B-${suffix}`,
            optionValueIds: [value!.id],
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'VARIANT_COMBINATION_DUPLICATE' });
  });

  it('rechaza imágenes cuyo contenido no es una imagen válida', async () => {
    const product = await createSimpleProduct(
      `imagen-invalida-${randomUUID().slice(0, 8)}`,
    );
    const buffer = Buffer.from('esto no es una imagen');

    await expect(
      imageService.processUpload(product.id, {
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'falsa.png',
      } as Express.Multer.File),
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('rechaza tamaños excedidos y formatos no permitidos', async () => {
    const product = await createSimpleProduct(
      `imagen-limites-${randomUUID().slice(0, 8)}`,
    );
    const png = await pngFile();

    await expect(
      imageService.processUpload(product.id, {
        ...png,
        size: 6 * 1024 * 1024,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE' });

    const gif = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
      'base64',
    );
    await expect(
      imageService.processUpload(product.id, {
        buffer: gif,
        size: gif.length,
        mimetype: 'image/gif',
        originalname: 'animacion.gif',
      } as Express.Multer.File),
    ).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });

  it('ajusta inventario con movimiento y auditoría, sin stock negativo (RN-INV-01, RF-INV-02)', async () => {
    const product = await createSimpleProduct(
      `inventario-${randomUUID().slice(0, 8)}`,
      2,
    );
    const variantId = product.variants[0].id;
    const inventoryModel = app.get<typeof InventoryItem>(
      getModelToken(InventoryItem),
    );

    await expect(
      inventory.adjust(
        variantId,
        { delta: -5, note: 'Prueba negativa' },
        actorId,
      ),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });

    await expect(
      inventoryModel.update({ quantity: -1 }, { where: { variantId } }),
    ).rejects.toThrow();

    const adjusted = await inventory.adjust(
      variantId,
      { delta: -2, note: 'Merma de prueba' },
      actorId,
    );
    expect(adjusted.quantity).toBe(0);

    const movements = await inventory.listMovements(variantId, 1, 20);
    expect(movements.items.map((movement) => movement.reason)).toEqual(
      expect.arrayContaining(['INITIAL', 'ADJUSTMENT']),
    );

    const auditLog = app.get<typeof AuditLog>(getModelToken(AuditLog));
    const audit = await auditLog.findOne({
      where: { action: 'inventory.adjust', actorId },
    });
    expect(audit).not.toBeNull();

    await inventory.adjust(
      variantId,
      { allowBackorder: true, note: 'Permitir preventa' },
      actorId,
    );
    const listed = await catalog.getAdminProduct(product.id);
    expect(listed.variants[0]).toMatchObject({
      quantity: 0,
      allowBackorder: true,
    });

    await catalog.addImage(product.id, await pngFile(), 'Camisa');
    await catalog.changeStatus(product.id, 'PUBLISHED');
    const publicProduct = await catalog.getPublicProduct(
      product.id,
      'es',
      undefined,
    );
    expect(publicProduct.variants[0].available).toBe(true);
  });

  it('mantiene el error de negocio con formato estable', async () => {
    const error = new AppException(409, 'CONFLICT', 'conflicto de prueba');
    expect(error.code).toBe('CONFLICT');
  });
});
