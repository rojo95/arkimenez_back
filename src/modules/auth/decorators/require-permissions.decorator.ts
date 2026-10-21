import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '../../roles-permissions/permissions.constants';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Exige **todos** los permisos indicados (AND). Sin metadatos, la ruta solo
 * requiere sesión.
 */
export const RequirePermissions = (
  ...permissions: PermissionCode[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
