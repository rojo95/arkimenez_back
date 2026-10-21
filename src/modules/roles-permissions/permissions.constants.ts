/**
 * Fuente de verdad de la matriz RBAC (SDD §8 y `plan/architecture/permissions.md`).
 * El seeder la aplica de forma idempotente.
 */
export const PERMISSIONS = [
  {
    code: 'product:read_admin',
    description: 'Ver productos en administración',
  },
  {
    code: 'product:write',
    description: 'Crear y editar productos, variantes y atributos',
  },
  {
    code: 'product:publish',
    description: 'Publicar, despublicar y archivar productos',
  },
  { code: 'category:write', description: 'Crear, editar y activar categorías' },
  { code: 'inventory:read', description: 'Consultar stock y movimientos' },
  {
    code: 'inventory:adjust',
    description: 'Ajustar stock con motivo obligatorio',
  },
  { code: 'order:read', description: 'Consultar todos los pedidos' },
  {
    code: 'order:update_status',
    description: 'Cambiar el estado de los pedidos',
  },
  { code: 'customer:read', description: 'Consultar datos de clientes' },
  { code: 'staff:manage', description: 'Crear, activar y desactivar personal' },
  { code: 'role:assign', description: 'Asignar roles a usuarios' },
  {
    code: 'settings:write',
    description: 'Modificar la configuración de la tienda',
  },
  { code: 'audit:read', description: 'Consultar el registro de auditoría' },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]['code'];

export const ALL_PERMISSIONS: readonly PermissionCode[] = PERMISSIONS.map(
  (permission) => permission.code,
);

export const ROLES = [
  { code: 'OWNER', name: 'Propietario' },
  { code: 'ADMIN', name: 'Administrador' },
  { code: 'CATALOG_MANAGER', name: 'Gestor de catálogo' },
  { code: 'INVENTORY_MANAGER', name: 'Gestor de inventario' },
  { code: 'ORDER_MANAGER', name: 'Gestor de pedidos' },
  { code: 'CUSTOMER', name: 'Cliente' },
] as const;

export type RoleCode = (typeof ROLES)[number]['code'];

/** Matriz de la MVP: permisos por rol (la unión de roles define los permisos). */
export const ROLE_PERMISSIONS: Record<RoleCode, readonly PermissionCode[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: ALL_PERMISSIONS,
  CATALOG_MANAGER: [
    'product:read_admin',
    'product:write',
    'product:publish',
    'category:write',
    'inventory:read',
  ],
  INVENTORY_MANAGER: [
    'product:read_admin',
    'inventory:read',
    'inventory:adjust',
  ],
  ORDER_MANAGER: [
    'inventory:read',
    'order:read',
    'order:update_status',
    'customer:read',
  ],
  CUSTOMER: [],
};
