import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module';
import { User } from '../../src/modules/users/models/user.model';

/**
 * Verifica las restricciones del esquema contra PostgreSQL real
 * (AGENTS.md §9: transacciones, restricciones y concurrencia no se mockean).
 */
describe('Esquema en PostgreSQL (integración)', () => {
  let app: INestApplicationContext;
  let sequelize: Sequelize;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });
    sequelize = app.get(Sequelize);
  });

  afterAll(async () => {
    await app.close();
  });

  function userRow(
    overrides: Record<string, unknown>,
  ): Record<string, unknown> {
    const now = new Date();
    return {
      id: randomUUID(),
      name: 'Prueba',
      email: `${randomUUID()}@tiendalujosa.test`,
      password_hash: 'hash',
      status: 'ACTIVE',
      is_staff: false,
      created_at: now,
      updated_at: now,
      ...overrides,
    };
  }

  it('crea todas las tablas del MVP', async () => {
    const tables = (await sequelize
      .getQueryInterface()
      .showAllTables()) as unknown as Array<string | { tableName: string }>;
    const names = tables.map((table) =>
      typeof table === 'string' ? table : table.tableName,
    );

    expect(names).toEqual(
      expect.arrayContaining([
        'users',
        'roles',
        'permissions',
        'role_permissions',
        'user_roles',
        'refresh_tokens',
        'store_settings',
        'audit_logs',
      ]),
    );
  });

  it('rechaza un estado de usuario fuera del CHECK', async () => {
    await expect(
      sequelize
        .getQueryInterface()
        .bulkInsert('users', [userRow({ status: 'BOGUS' })]),
    ).rejects.toThrow();
  });

  it('impone el email único', async () => {
    const email = `duplicado.${randomUUID()}@tiendalujosa.test`;
    const queryInterface = sequelize.getQueryInterface();

    await queryInterface.bulkInsert('users', [userRow({ email })]);

    await expect(
      queryInterface.bulkInsert('users', [userRow({ email })]),
    ).rejects.toThrow();

    await queryInterface.bulkDelete('users', { email });
  });

  it('acepta un usuario válido', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const userModel = app.get<typeof User>(getModelToken(User));
    const row = userRow({});

    await queryInterface.bulkInsert('users', [row]);
    expect(await userModel.count({ where: { id: row.id as string } })).toBe(1);

    await queryInterface.bulkDelete('users', { id: row.id as string });
  });
});
