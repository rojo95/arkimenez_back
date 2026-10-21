import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Permission } from './models/permission.model';
import { Role } from './models/role.model';
import { RolePermission } from './models/role-permission.model';
import { UserRole } from './models/user-role.model';
import { RolesPermissionsService } from './roles-permissions.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Role, Permission, RolePermission, UserRole]),
  ],
  providers: [RolesPermissionsService],
  exports: [RolesPermissionsService],
})
export class RolesPermissionsModule {}
