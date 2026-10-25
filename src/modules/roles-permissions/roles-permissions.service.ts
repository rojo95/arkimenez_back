import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type Transaction } from 'sequelize';
import { Permission } from './models/permission.model';
import { Role } from './models/role.model';
import { RolePermission } from './models/role-permission.model';
import { UserRole } from './models/user-role.model';

const CACHE_TTL_MS = 30_000;

interface CachedPermissions {
  permissions: string[];
  expiresAt: number;
}

/**
 * Resuelve los permisos de un usuario a partir de sus roles en base de datos.
 *
 * Nunca se deducen del nombre del rol. La caché es de 30 s: un cambio de rol
 * debe invalidarse explícitamente (`invalidate`) para que surta efecto de
 * inmediato (ADR-0002).
 */
@Injectable()
export class RolesPermissionsService {
  private readonly cache = new Map<string, CachedPermissions>();

  constructor(
    @InjectModel(Role) private readonly roleModel: typeof Role,
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    @InjectModel(RolePermission)
    private readonly rolePermissionModel: typeof RolePermission,
    @InjectModel(UserRole) private readonly userRoleModel: typeof UserRole,
  ) {}

  async getPermissionsForUser(userId: string): Promise<string[]> {
    const cached = this.cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const userRoles = await this.userRoleModel.findAll({
      where: { userId },
      attributes: ['roleId'],
      raw: true,
    });
    const roleIds = [...new Set(userRoles.map((row) => row.roleId))];

    let permissions: string[] = [];
    if (roleIds.length > 0) {
      const links = await this.rolePermissionModel.findAll({
        where: { roleId: { [Op.in]: roleIds } },
        attributes: ['permissionId'],
        raw: true,
      });
      const permissionIds = [...new Set(links.map((row) => row.permissionId))];
      if (permissionIds.length > 0) {
        const rows = await this.permissionModel.findAll({
          where: { id: { [Op.in]: permissionIds } },
          attributes: ['code'],
          raw: true,
        });
        permissions = rows.map((row) => row.code);
      }
    }

    permissions = [...new Set(permissions)].sort();
    this.cache.set(userId, {
      permissions,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return permissions;
  }

  /**
   * Asigna un rol existente a un usuario. No crea roles: el seeder es la única
   * fuente de la matriz del MVP.
   */
  async assignRole(
    userId: string,
    roleCode: string,
    transaction?: Transaction,
  ): Promise<void> {
    const role = await this.roleModel.findOne({
      where: { code: roleCode },
      transaction,
    });
    if (!role) {
      throw new InternalServerErrorException(
        `El rol ${roleCode} no existe; ejecuta el seeder`,
      );
    }

    await this.userRoleModel.findOrCreate({
      where: { userId, roleId: role.id },
      defaults: { userId, roleId: role.id },
      transaction,
    });
    this.invalidate(userId);
  }

  /** Invalida la caché de un usuario (asignar/quitar rol, desactivar cuenta). */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /** Invalida toda la caché (cambios en la matriz de permisos). */
  invalidateAll(): void {
    this.cache.clear();
  }
}
