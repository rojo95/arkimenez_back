import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import cookieParser from 'cookie-parser';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { CatalogService } from '../../src/modules/catalog/catalog.service';
import { InventoryItem } from '../../src/modules/inventory/models/inventory-item.model';
import { SeedService } from '../../src/modules/seed/seed.service';

describe('Checkout e idempotencia (integración)', () => {
  let app: INestApplication;
  let server: any;
  let appToken: string;
  let catalog: CatalogService;

  beforeAll(async () => {
    const nestApp = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn'],
    });
    nestApp.use(cookieParser());
    nestApp.setGlobalPrefix('api/v1');
    await nestApp.init();
    app = nestApp;
    server = nestApp.getHttpServer();
    appToken = process.env.APP_ACCESS_TOKEN ?? '';
    catalog = app.get(CatalogService);

    // El seed se ejecuta sobre la MISMA instancia de Sequelize que usa la app:
    // abrir un segundo ApplicationContext con SeedModule crea otra conexión
    // para las mismas clases de modelo y su close() deja sin conexión a la app.
    await app.get(SeedService).run();
  });

  afterAll(async () => {
    await app.close();
  });

  async function pngFile() {
    const buffer = await sharp({
      create: { width: 12, height: 12, channels: 3, background: { r: 200, g: 180, b: 160 } },
    })
      .png()
      .toBuffer();
    return {
      buffer,
      size: buffer.length,
      mimetype: 'image/png',
      originalname: 'producto.png',
    } as Express.Multer.File;
  }

  async function createPublishedProduct(stock: number) {
    const product = await catalog.createProduct({
      type: 'SIMPLE',
      basePriceMinor: 2500,
      translations: [{ locale: 'es', name: `Producto ${randomUUID().slice(0, 6)}` }],
      variants: [{ sku: `SKU-${randomUUID().slice(0, 6)}`, initialStock: stock }],
    });
    await catalog.addImage(product.id, await pngFile(), 'Producto');
    await catalog.changeStatus(product.id, 'PUBLISHED');
    return product;
  }

  async function registerAndLogin(email: string) {
    await request(server)
      .post('/api/v1/auth/register')
      .set('x-app-token', appToken)
      .send({ name: 'Cliente', email, password: 'PasswordSegura123' })
      .expect(201);
    const agent = request.agent(server);
    const login = await agent
      .post('/api/v1/auth/login')
      .set('x-app-token', appToken)
      .send({ email, password: 'PasswordSegura123' })
      .expect(200);
    const csrfCookie = (login.headers['set-cookie'] as unknown as string[])
      .find((c) => c.startsWith('tl_csrf='));
    const csrf = csrfCookie ? csrfCookie.split(';')[0].slice('tl_csrf='.length) : '';
    return { agent, csrf: csrf ?? '' };
  }

  it('valida un carrito de invitado', async () => {
    const product = await createPublishedProduct(3);
    const variantId = product.variants[0].id;

    const response = await request(server)
      .post('/api/v1/cart/validate')
      .set('x-app-token', appToken)
      .send({ items: [{ variantId, quantity: 2 }] })
      .expect(200);

    expect(response.body.subtotalMinor).toBe(5000);
    expect(response.body.items[0].available).toBe(true);
    expect(response.body.items[0].stockQuantity).toBe(3);
  });

  it('crea un pedido de forma idempotente', async () => {
    const product = await createPublishedProduct(5);
    const variantId = product.variants[0].id;
    const email = `idemp.${randomUUID()}@tiendalujosa.test`;
    const { agent, csrf } = await registerAndLogin(email);

    const key = randomUUID();
    const payload = {
      items: [{ variantId, quantity: 2 }],
      shippingAddress: {
        fullName: 'Cliente Prueba',
        phone: '+34600111222',
        line1: 'Calle Mayor 1',
        city: 'Madrid',
        region: 'Madrid',
        postalCode: '28001',
        countryCode: 'es',
      },
    };

    const first = await agent
      .post('/api/v1/checkout')
      .set('x-app-token', appToken)
      .set('x-csrf-token', csrf)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(201);

    const second = await agent
      .post('/api/v1/checkout')
      .set('x-app-token', appToken)
      .set('x-csrf-token', csrf)
      .set('Idempotency-Key', key)
      .send(payload)
      .expect(200);

    expect(second.body.order.id).toBe(first.body.order.id);
    expect(second.body.created).toBe(false);

    const inventoryModel = app.get<typeof InventoryItem>(getModelToken(InventoryItem));
    const inv = await inventoryModel.findOne({ where: { variantId } });
    expect(inv?.quantity).toBe(3);
  });

  it('rechaza stock insuficiente y no deja pedido parcial (RN-ORD-02)', async () => {
    const product = await createPublishedProduct(1);
    const variantId = product.variants[0].id;
    const email = `stock.${randomUUID()}@tiendalujosa.test`;
    const { agent, csrf } = await registerAndLogin(email);

    const payload = {
      items: [{ variantId, quantity: 2 }],
      shippingAddress: {
        fullName: 'Cliente Prueba',
        phone: '+34600111222',
        line1: 'Calle Mayor 1',
        city: 'Madrid',
        region: 'Madrid',
        postalCode: '28001',
        countryCode: 'es',
      },
    };

    await agent
      .post('/api/v1/checkout')
      .set('x-app-token', appToken)
      .set('x-csrf-token', csrf)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(409);

    const inventoryModel = app.get<typeof InventoryItem>(getModelToken(InventoryItem));
    const inv = await inventoryModel.findOne({ where: { variantId } });
    expect(inv?.quantity).toBe(1);
  });

  it('maneja dos checkouts simultáneos con stock 1 (RN-ORD-02)', async () => {
    const product = await createPublishedProduct(1);
    const variantId = product.variants[0].id;

    const emailA = `conc-a.${randomUUID()}@tiendalujosa.test`;
    const emailB = `conc-b.${randomUUID()}@tiendalujosa.test`;
    const a = await registerAndLogin(emailA);
    const b = await registerAndLogin(emailB);

    const payload = () => ({
      items: [{ variantId, quantity: 1 }],
      shippingAddress: {
        fullName: 'Cliente',
        phone: '+34600111222',
        line1: 'Calle Mayor 1',
        city: 'Madrid',
        region: 'Madrid',
        postalCode: '28001',
        countryCode: 'es',
      },
    });

    const results = await Promise.allSettled([
      a.agent
        .post('/api/v1/checkout')
        .set('x-app-token', appToken)
        .set('x-csrf-token', a.csrf)
        .set('Idempotency-Key', randomUUID())
        .send(payload()),
      b.agent
        .post('/api/v1/checkout')
        .set('x-app-token', appToken)
        .set('x-csrf-token', b.csrf)
        .set('Idempotency-Key', randomUUID())
        .send(payload()),
    ]);

    const statuses = results.map((r) =>
      r.status === 'fulfilled' ? r.value.status : (r.reason?.status ?? 0),
    );
    expect(statuses.sort()).toEqual([201, 409]);

    const inventoryModel = app.get<typeof InventoryItem>(getModelToken(InventoryItem));
    const inv = await inventoryModel.findOne({ where: { variantId } });
    expect(inv?.quantity).toBe(0);
  });
});
