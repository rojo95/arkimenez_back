import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Permission } from '../../src/modules/roles-permissions/models/permission.model';
import { Role } from '../../src/modules/roles-permissions/models/role.model';
import { RolePermission } from '../../src/modules/roles-permissions/models/role-permission.model';
import { UserRole } from '../../src/modules/roles-permissions/models/user-role.model';
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  type RoleCode,
} from '../../src/modules/roles-permissions/permissions.constants';
import { SeedModule } from '../../src/modules/seed/seed.module';
import { SeedService } from '../../src/modules/seed/seed.service';
import { StoreSetting } from '../../src/modules/store-settings/models/store-setting.model';
import { User } from '../../src/modules/users/models/user.model';
import { PasswordHasher } from '../../src/modules/users/password-hasher';

describe('Seeder contra PostgreSQL (integración)', () => {
  let app: INestApplicationContext;
  let sequelize: Sequelize;
  let seedService: SeedService;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(SeedModule, {
      logger: false,
    });
    sequelize = app.get(Sequelize);
    seedService = app.get(SeedService);

    const queryInterface = sequelize.getQueryInterface();
    await queryInterface.bulkDelete('role_permissions', {});
    await queryInterface.bulkDelete('user_roles', {});
    await queryInterface.bulkDelete('users', {});
    await queryInterface.bulkDelete('roles', {});
    await queryInterface.bulkDelete('permissions', {});
    await queryInterface.bulkDelete('store_settings', {});
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea la matriz RBAC y es idempotente', async () => {
    await seedService.run();
    await seedService.run();

    const permissionModel = app.get<typeof Permission>(
      getModelToken(Permission),
    );
    const roleModel = app.get<typeof Role>(getModelToken(Role));
    const rolePermissionModel = app.get<typeof RolePermission>(
      getModelToken(RolePermission),
    );
    const userRoleModel = app.get<typeof UserRole>(getModelToken(UserRole));

    expect(await permissionModel.count()).toBe(PERMISSIONS.length);
    expect(await roleModel.count()).toBe(ROLES.length);

    const expectedLinks = Object.values(ROLE_PERMISSIONS).reduce(
      (total, permissionCodes) => total + permissionCodes.length,
      0,
    );
    expect(await rolePermissionModel.count()).toBe(expectedLinks);
    expect(await userRoleModel.count()).toBe(1);
  });

  it('respeta la matriz de permisos por rol', async () => {
    const roleModel = app.get<typeof Role>(getModelToken(Role));
    const permissionModel = app.get<typeof Permission>(
      getModelToken(Permission),
    );
    const rolePermissionModel = app.get<typeof RolePermission>(
      getModelToken(RolePermission),
    );

    const roles = await roleModel.findAll({ raw: true });
    const permissions = await permissionModel.findAll({ raw: true });
    const links = await rolePermissionModel.findAll({ raw: true });

    const permissionCodeById = new Map(
      permissions.map((permission) => [permission.id, permission.code]),
    );

    for (const role of roles) {
      const actual = links
        .filter((link) => link.roleId === role.id)
        .map((link) => permissionCodeById.get(link.permissionId))
        .filter((code): code is string => typeof code === 'string')
        .sort();
      const expected = [...ROLE_PERMISSIONS[role.code as RoleCode]].sort();

      expect({ role: role.code, permissions: actual }).toEqual({
        role: role.code,
        permissions: expected,
      });
    }
  });

  it('crea el OWNER inicial con la contraseña hasheada', async () => {
    const userModel = app.get<typeof User>(getModelToken(User));
    const passwordHasher = app.get(PasswordHasher);

    const owner = await userModel.findOne({
      where: { email: process.env.INITIAL_OWNER_EMAIL },
    });

    expect(owner).not.toBeNull();
    expect(owner?.isStaff).toBe(true);
    expect(owner?.passwordHash).not.toBe(process.env.INITIAL_OWNER_PASSWORD);
    await expect(
      passwordHasher.verify(
        owner?.passwordHash ?? '',
        process.env.INITIAL_OWNER_PASSWORD ?? '',
      ),
    ).resolves.toBe(true);
  });

  it('crea los ajustes iniciales de la tienda sin sobrescribirlos', async () => {
    const settingModel = app.get<typeof StoreSetting>(
      getModelToken(StoreSetting),
    );

    const keys = (
      await settingModel.findAll({ attributes: ['key'], raw: true })
    ).map((row) => row.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        'store.name',
        'store.currency',
        'i18n.locale.default',
      ]),
    );
  });
});
