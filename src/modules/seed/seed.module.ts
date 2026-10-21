import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { envValidationSchema } from '../../config/env.validation';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { Permission } from '../roles-permissions/models/permission.model';
import { Role } from '../roles-permissions/models/role.model';
import { RolePermission } from '../roles-permissions/models/role-permission.model';
import { UserRole } from '../roles-permissions/models/user-role.model';
import { StoreSetting } from '../store-settings/models/store-setting.model';
import { User } from '../users/models/user.model';
import { PasswordHasher } from '../users/password-hasher';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    DatabaseModule,
    SequelizeModule.forFeature([
      User,
      Role,
      Permission,
      RolePermission,
      UserRole,
      StoreSetting,
    ]),
  ],
  providers: [PasswordHasher, SeedService],
})
export class SeedModule {}
