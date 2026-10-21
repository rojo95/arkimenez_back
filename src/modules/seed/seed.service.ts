import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import type { Transaction } from 'sequelize';
import { Role } from '../roles-permissions/models/role.model';
import { Permission } from '../roles-permissions/models/permission.model';
import { RolePermission } from '../roles-permissions/models/role-permission.model';
import { UserRole } from '../roles-permissions/models/user-role.model';
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  type PermissionCode,
  type RoleCode,
} from '../roles-permissions/permissions.constants';
import { StoreSetting } from '../store-settings/models/store-setting.model';
import { User } from '../users/models/user.model';
import { PasswordHasher } from '../users/password-hasher';

/**
 * Seeder idempotente (plan/architecture/permissions.md).
 *
 * Crea/actualiza permisos, roles y la matriz de la MVP, los valores iniciales
 * de la tienda y el primer OWNER (solo si no existe ninguno). Nunca
 * sobrescribe valores existentes ni elimina permisos añadidos a mano.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly sequelize: Sequelize,
    private readonly passwordHasher: PasswordHasher,
    @InjectModel(User) private readonly userModel: typeof User,
    @InjectModel(Role) private readonly roleModel: typeof Role,
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    @InjectModel(RolePermission)
    private readonly rolePermissionModel: typeof RolePermission,
    @InjectModel(UserRole) private readonly userRoleModel: typeof UserRole,
    @InjectModel(StoreSetting)
    private readonly storeSettingModel: typeof StoreSetting,
  ) {}

  async run(): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      const permissions = await this.ensurePermissions(transaction);
      const roles = await this.ensureRoles(transaction);
      await this.ensureRolePermissions(roles, permissions, transaction);
      await this.ensureStoreSettings(transaction);
      await this.ensureFirstOwner(roles, transaction);
    });

    this.logger.log('Seeding completado');
  }

  private async ensurePermissions(
    transaction: Transaction,
  ): Promise<Map<string, Permission>> {
    const permissions = new Map<string, Permission>();

    for (const { code, description } of PERMISSIONS) {
      const [permission, created] = await this.permissionModel.findOrCreate({
        where: { code },
        defaults: { code, description },
        transaction,
      });

      if (!created && permission.description !== description) {
        permission.description = description;
        await permission.save({ transaction });
      }

      permissions.set(code, permission);
    }

    return permissions;
  }

  private async ensureRoles(
    transaction: Transaction,
  ): Promise<Map<string, Role>> {
    const roles = new Map<string, Role>();

    for (const { code, name } of ROLES) {
      const [role, created] = await this.roleModel.findOrCreate({
        where: { code },
        defaults: { code, name },
        transaction,
      });

      if (!created && role.name !== name) {
        role.name = name;
        await role.save({ transaction });
      }

      roles.set(code, role);
    }

    return roles;
  }

  private async ensureRolePermissions(
    roles: Map<string, Role>,
    permissions: Map<string, Permission>,
    transaction: Transaction,
  ): Promise<void> {
    const entries = Object.entries(ROLE_PERMISSIONS) as [
      RoleCode,
      readonly PermissionCode[],
    ][];

    for (const [roleCode, permissionCodes] of entries) {
      const role = roles.get(roleCode);
      if (!role) {
        throw new Error(`Rol desconocido en la matriz: ${roleCode}`);
      }

      for (const permissionCode of permissionCodes) {
        const permission = permissions.get(permissionCode);
        if (!permission) {
          throw new Error(
            `Permiso desconocido en la matriz: ${permissionCode}`,
          );
        }

        await this.rolePermissionModel.findOrCreate({
          where: { roleId: role.id, permissionId: permission.id },
          defaults: { roleId: role.id, permissionId: permission.id },
          transaction,
        });
      }
    }
  }

  private async ensureStoreSettings(transaction: Transaction): Promise<void> {
    const defaultLocale = this.config.get<string>('DEFAULT_LOCALE') ?? 'es';
    const activeLocales = (this.config.get<string>('ACTIVE_LOCALES') ?? 'es')
      .split(',')
      .map((locale) => locale.trim())
      .filter((locale) => locale.length > 0);

    const settings: Record<string, string> = {
      'store.name': this.config.get<string>('STORE_NAME') ?? 'tiendaLujosa',
      'store.currency': this.config.get<string>('STORE_CURRENCY') ?? 'EUR',
      'i18n.locale.default': defaultLocale,
    };

    for (const locale of activeLocales) {
      settings[`i18n.locale.${locale}.active`] = 'true';
    }

    for (const [key, value] of Object.entries(settings)) {
      await this.storeSettingModel.findOrCreate({
        where: { key },
        defaults: { key, value },
        transaction,
      });
    }
  }

  private async ensureFirstOwner(
    roles: Map<string, Role>,
    transaction: Transaction,
  ): Promise<void> {
    const ownerRole = roles.get('OWNER');
    if (!ownerRole) {
      throw new Error('No se encontró el rol OWNER tras crearlo');
    }

    const ownersCount = await this.userRoleModel.count({
      where: { roleId: ownerRole.id },
      transaction,
    });
    if (ownersCount > 0) {
      this.logger.log('Ya existe un OWNER; no se crea ninguno nuevo');
      return;
    }

    const email = this.config.get<string>('INITIAL_OWNER_EMAIL')?.trim();
    const password = this.config.get<string>('INITIAL_OWNER_PASSWORD');

    if (!email || !password) {
      throw new Error(
        'No hay ningún OWNER. Define INITIAL_OWNER_EMAIL e INITIAL_OWNER_PASSWORD para crear el primero.',
      );
    }

    const existingUser = await this.userModel.findOne({
      where: { email },
      transaction,
    });

    const user =
      existingUser ??
      (await this.userModel.create(
        {
          email,
          name: 'Propietario',
          passwordHash: await this.passwordHasher.hash(password),
          status: 'ACTIVE',
          isStaff: true,
        },
        { transaction },
      ));

    await this.userRoleModel.findOrCreate({
      where: { userId: user.id, roleId: ownerRole.id },
      defaults: { userId: user.id, roleId: ownerRole.id },
      transaction,
    });

    this.logger.log(`OWNER inicial asegurado para ${email}`);
  }
}
