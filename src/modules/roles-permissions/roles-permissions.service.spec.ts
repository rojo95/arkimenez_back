import { RolesPermissionsService } from './roles-permissions.service';
import { Permission } from './models/permission.model';
import { RolePermission } from './models/role-permission.model';
import { UserRole } from './models/user-role.model';

describe('RolesPermissionsService', () => {
  const userRoleModel = { findAll: jest.fn() };
  const rolePermissionModel = { findAll: jest.fn() };
  const permissionModel = { findAll: jest.fn() };

  let service: RolesPermissionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RolesPermissionsService(
      permissionModel as unknown as typeof Permission,
      rolePermissionModel as unknown as typeof RolePermission,
      userRoleModel as unknown as typeof UserRole,
    );
  });

  it('une los permisos de todos los roles del usuario', async () => {
    userRoleModel.findAll.mockResolvedValue([
      { roleId: 'r1' },
      { roleId: 'r2' },
    ]);
    rolePermissionModel.findAll.mockResolvedValue([
      { permissionId: 'p1' },
      { permissionId: 'p2' },
    ]);
    permissionModel.findAll.mockResolvedValue([
      { code: 'order:read' },
      { code: 'inventory:read' },
    ]);

    const permissions = await service.getPermissionsForUser('u1');

    expect(permissions).toEqual(['inventory:read', 'order:read']);
  });

  it('devuelve lista vacía si el usuario no tiene roles', async () => {
    userRoleModel.findAll.mockResolvedValue([]);

    await expect(service.getPermissionsForUser('u1')).resolves.toEqual([]);
    expect(rolePermissionModel.findAll).not.toHaveBeenCalled();
  });

  it('usa la caché en consultas repetidas', async () => {
    userRoleModel.findAll.mockResolvedValue([]);

    await service.getPermissionsForUser('u1');
    await service.getPermissionsForUser('u1');

    expect(userRoleModel.findAll).toHaveBeenCalledTimes(1);
  });

  it('invalidate fuerza una nueva consulta', async () => {
    userRoleModel.findAll.mockResolvedValue([]);

    await service.getPermissionsForUser('u1');
    service.invalidate('u1');
    await service.getPermissionsForUser('u1');

    expect(userRoleModel.findAll).toHaveBeenCalledTimes(2);
  });
});
